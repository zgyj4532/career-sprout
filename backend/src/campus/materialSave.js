import { createHash, randomUUID } from 'node:crypto';
import Resume from '../models/Resume.model.js';
import ResumeVersion from '../models/ResumeVersion.model.js';
import { CampusJob, CampusSaveOperation, CampusResumeTombstone } from './models.js';
import { campusError } from './errors.js';
import { stableImportId } from './confirmLedger.js';
import { planResumeUpdate } from './resumeRevision.js';
import { withResumeLock } from './resumeDelete.js';
import { withAccountWrite } from './accountWrites.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  return value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])])) : value;
}
function resource(value) {
  const { _id, __v, saveReceipts, ...rest } = value;
  return { ...rest, id: String(_id) };
}
function assertOperationId(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(id)) throw campusError(400, 'INVALID_OPERATION_ID', '保存操作编号不正确。');
}
async function freezeSave(kind, uid, id, body, operationId, isTeacher) {
  const model = kind === 'resume' ? Resume : CampusJob;
  const owner = kind === 'resume' ? { userId: uid } : { creatorUid: uid };
  const receipt = stableImportId(uid, `${kind}:${operationId}`);
  const resourceId = id || stableImportId(receipt, kind);
  const now = new Date();
  const { operationId: ignored, expectedUpdatedAt, ...payload } = body;
  let result, update, filter;
  if (id) {
    const current = await model.findOne({ _id: id, ...owner }).lean();
    if (!current || current.deleting) throw campusError(404, 'NOT_FOUND', '材料不存在或不可修改。');
    now.setTime(Math.max(now.getTime(), new Date(current.updatedAt || current.lastModified || 0).getTime() + 1));
    if (kind === 'resume') {
      const plan = planResumeUpdate(current, payload);
      if (plan.error) throw campusError(409, 'REVISION_CONFLICT', '简历版本已变化，请保留编辑并重新核对。');
      filter = plan.filter;
      update = plan.update;
      update.$set.lastModified = now;
      result = { ...current, ...update.$set };
      for (const [key, amount] of Object.entries(update.$inc || {})) result[key] = (result[key] || 0) + amount;
    } else {
      if (expectedUpdatedAt === undefined || new Date(expectedUpdatedAt).getTime() !== new Date(current.updatedAt).getTime()) throw campusError(409, 'JOB_CHANGED', '岗位已经变化，请保留编辑并重新核对。');
      if (payload.authorKind !== undefined) payload.authorKind = isTeacher ? 'teacher' : payload.authorKind === 'alumni' ? 'alumni' : 'student';
      filter = { _id: id, ...owner, updatedAt: current.updatedAt };
      update = { $set: { ...payload, updatedAt: now } };
      result = { ...current, ...update.$set };
    }
    update.$addToSet = { saveReceipts: receipt };
  } else {
    if (kind === 'job') payload.authorKind = isTeacher ? 'teacher' : payload.authorKind === 'alumni' ? 'alumni' : 'student';
    result = new model({ ...payload, _id: resourceId, ...owner, saveReceipts: [receipt], createdAt: now, ...(kind === 'resume' ? { lastModified: now } : { updatedAt: now }) }).toObject();
    await new model(result).validate();
  }
  return { resourceId, receipt, owner, create: !id, result: resource(result), document: result, filter, update };
}

async function alive(ledger) {
  if (ledger.status === 'cancelled') throw campusError(409, 'MATERIAL_DELETED', '这次保存对应的数据已删除，不会因重试重新创建。');
  if (ledger.kind !== 'resume') return;
  if (await CampusResumeTombstone.exists({ resumeId: ledger.resourceId, userId: ledger.userId })) throw campusError(409, 'RESUME_DELETED', '简历已删除，不会因重试重新创建。');
}
async function initialVersion(ledger) {
  if (ledger.kind !== 'resume' || !ledger.frozen.create) return;
  const value = ledger.frozen.document;
  const versionId = stableImportId(ledger.frozen.receipt, 'version');
  await ResumeVersion.updateOne({ _id: versionId, userId: ledger.userId }, { $setOnInsert: {
    resumeId: ledger.resourceId, userId: ledger.userId, versionNumber: 1, title: 'v1 - Initial Draft',
    originalText: value.originalText, enhancedText: value.enhancedText, jobRole: value.jobRole, atsScore: value.atsScore,
    tags: ['initial-draft'], metadata: { source: 'editor' },
  } }, { upsert: true, runValidators: true });
}
async function finishSave(ledger) {
  await alive(ledger);
  await initialVersion(ledger);
  const written = await CampusSaveOperation.updateOne({ _id: ledger._id, status: { $ne: 'cancelled' } }, { $set: { status: 'completed', result: ledger.frozen.result, leaseUntil: null } });
  if (!written.matchedCount) throw campusError(409, 'SAVE_CANCELLED', '这次保存已失效，不能恢复已删除的内容。');
  return ledger.frozen.result;
}

export function recoverMaterialSave(kind, uid, operationId) {
  return withAccountWrite(uid, () => recoverSave(kind, uid, operationId));
}
async function recoverSave(kind, uid, operationId) {
  assertOperationId(operationId);
  const ledger = await CampusSaveOperation.findOne({ kind, userId: uid, operationId }).lean();
  if (!ledger) throw campusError(404, 'SAVE_NOT_FOUND', '没有找到这次保存，可使用相同操作编号继续保存。');
  await alive(ledger);
  const model = kind === 'resume' ? Resume : CampusJob;
  const current = await model.findOne({ _id: ledger.resourceId, ...ledger.frozen.owner }).lean();
  if (!current || current.deleting) {
    if (ledger.status === 'completed') throw campusError(409, 'MATERIAL_DELETED', '已保存的材料后来被删除，不会重新创建。');
    throw campusError(404, 'SAVE_NOT_FOUND', '保存尚未完成，可使用相同操作编号继续。');
  }
  if (!current.saveReceipts?.includes(ledger.frozen.receipt)) throw campusError(404, 'SAVE_NOT_FOUND', '尚未确认这次保存，可使用相同操作编号继续。');
  const finish = async () => { await alive(ledger); return ledger.status === 'completed' ? ledger.result : finishSave(ledger); };
  return kind === 'resume' ? withResumeLock(ledger.resourceId, finish) : finish();
}

export function saveMaterial(options) {
  return withAccountWrite(options.uid, () => persistMaterial(options));
}
async function persistMaterial({ kind, uid, id = null, body, isTeacher = false }) {
  const { operationId } = body;
  assertOperationId(operationId);
  const payloadHash = createHash('sha256').update(JSON.stringify(canonical({ id, body }))).digest('hex');
  let ledger = await CampusSaveOperation.findOne({ kind, userId: uid, operationId }).lean();
  if (!ledger) {
    const frozen = await freezeSave(kind, uid, id, body, operationId, isTeacher);
    try { ledger = (await CampusSaveOperation.create({ kind, userId: uid, operationId, payloadHash, resourceId: frozen.resourceId, frozen })).toObject(); }
    catch (error) {
      if (error.code !== 11000) throw error;
      ledger = await CampusSaveOperation.findOne({ kind, userId: uid, operationId }).lean();
    }
  }
  await alive(ledger);
  if (ledger.payloadHash !== payloadHash) throw campusError(409, 'OPERATION_CONFLICT', '这次保存已绑定另一份内容，请先恢复保存结果。');
  if (ledger.status === 'completed') return recoverMaterialSave(kind, uid, operationId);
  const token = randomUUID();
  const acquired = await CampusSaveOperation.findOneAndUpdate({ _id: ledger._id, status: { $ne: 'completed' }, $or: [{ leaseUntil: null }, { leaseUntil: { $lte: new Date() } }] }, { $set: { leaseToken: token, leaseUntil: new Date(Date.now() + 300000) } }, { new: true }).lean();
  if (!acquired) throw campusError(409, 'SAVE_PENDING', '这次保存正在进行，请先恢复保存结果。');
  ledger = acquired;
  const model = kind === 'resume' ? Resume : CampusJob;
  const frozen = ledger.frozen;
  try {
    await alive(ledger);
    const apply = async () => {
      await alive(ledger);
      const current = await model.findOne({ _id: ledger.resourceId, ...frozen.owner }).lean();
      if (current?.saveReceipts?.includes(frozen.receipt)) return;
      if (frozen.create) {
        if (current) throw campusError(409, 'OPERATION_CONFLICT', '保存目标已经存在，请恢复结果。');
        try { await new model(frozen.document).save({ timestamps: false }); }
        catch (error) { if (error.code !== 11000) throw error; }
      } else {
        const result = await model.updateOne(frozen.filter, frozen.update, { runValidators: true, timestamps: false });
        if (!result.matchedCount) throw campusError(409, kind === 'resume' ? 'REVISION_CONFLICT' : 'JOB_CHANGED', '材料已在其他页面更新，请保留当前编辑。');
      }
      const actual = await model.findOne({ _id: ledger.resourceId, ...frozen.owner }).lean();
      if (!actual?.saveReceipts?.includes(frozen.receipt)) throw campusError(409, 'SAVE_UNKNOWN', '保存结果需要恢复，当前编辑未被丢弃。');
    };
    const commit = async () => { await apply(); return finishSave(ledger); };
    if (kind === 'resume') return await withResumeLock(ledger.resourceId, commit);
    return await commit();
  } catch (error) {
    if (error.name === 'ValidationError' || ['REVISION_CONFLICT', 'JOB_CHANGED'].includes(error.code)) {
      const actual = await model.findOne({ _id: ledger.resourceId, ...frozen.owner }).lean();
      if (!actual?.saveReceipts?.includes(frozen.receipt)) await CampusSaveOperation.deleteOne({ _id: ledger._id, leaseToken: token });
    }
    throw error;
  } finally {
    await CampusSaveOperation.updateOne({ _id: ledger._id, leaseToken: token }, { $set: { leaseUntil: null } });
  }
}
