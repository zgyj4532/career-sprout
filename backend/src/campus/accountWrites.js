import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash } from 'node:crypto';
import { CampusAccountWriteState } from './models.js';
import { campusError } from './errors.js';

// Same single-writer process contract as resume association locks. Active work
// remains admitted until it settles, not until an HTTP client disconnects.
const accounts = new Map();
const ownership = new AsyncLocalStorage();
const accountKey = (uid) => createHash('sha256').update(uid).digest('hex');
function retainGate(uid) {
  if (!accounts.has(uid)) accounts.set(uid, { active: new Set(), erasing: false, generation: 0, users: 0 });
  const gate = accounts.get(uid);
  gate.users++;
  return gate;
}
function releaseGate(uid, gate) {
  gate.users--;
  if (!gate.users && !gate.active.size && !gate.erasing && accounts.get(uid) === gate) accounts.delete(uid);
}
async function state(uid) {
  return await CampusAccountWriteState.findById(accountKey(uid)).lean() || { epoch: 0, deleting: false };
}

export async function withAccountWrite(uid, operation) {
  if (ownership.getStore()?.uid === uid) return operation();
  const gate = retainGate(uid);
  const generation = gate.generation;
  let release, settled;
  try {
    const accepted = await state(uid);
    if (gate.erasing || accepted.deleting || generation !== gate.generation) throw campusError(409, 'ACCOUNT_ERASING', '账号数据正在删除或已变化，这次旧请求不会写入。');
    settled = new Promise((resolve) => { release = resolve; });
    gate.active.add(settled);
    const current = await state(uid);
    if (gate.erasing || current.deleting || current.epoch !== accepted.epoch) throw campusError(409, 'ACCOUNT_DATA_CHANGED', '账号数据已删除或正在删除，这次旧请求不会再写入。');
    return await ownership.run({ uid, epoch: current.epoch }, operation);
  } finally {
    if (settled) { gate.active.delete(settled); release(); }
    releaseGate(uid, gate);
  }
}

export async function withAccountErasure(uid, operation) {
  const gate = retainGate(uid);
  if (gate.erasing) { releaseGate(uid, gate); throw campusError(409, 'ACCOUNT_ERASING', '账号数据正在删除，请稍后查看结果。'); }
  gate.erasing = true;
  gate.generation++;
  try {
    await Promise.all([...gate.active]);
    // Failed erasure stays closed across restart; DELETE may explicitly retry.
    await CampusAccountWriteState.updateOne({ _id: accountKey(uid) }, { $set: { deleting: true }, $inc: { epoch: 1 } }, { upsert: true });
    const result = await ownership.run({ uid, erasing: true }, operation);
    await CampusAccountWriteState.updateOne({ _id: accountKey(uid) }, { $set: { deleting: false } });
    return result;
  } finally { gate.erasing = false; releaseGate(uid, gate); }
}

export const accountWriteHandler = (fn) => (req, res, next) => {
  const invoke = () => fn(req, res, next);
  Promise.resolve(req.user?.uid ? withAccountWrite(req.user.uid, invoke) : invoke()).catch(next);
};
