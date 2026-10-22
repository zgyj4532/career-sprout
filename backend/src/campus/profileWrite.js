import { campusError } from './errors.js';
import { withAccountWrite } from './accountWrites.js';

export function writeProfileFields(model, uid, fields, expectedUpdatedAt) {
  return withAccountWrite(uid, () => persistProfileFields(model, uid, fields, expectedUpdatedAt));
}
async function persistProfileFields(model, uid, fields, expectedUpdatedAt) {
  const current = await model.findOne({ uid }).select('updatedAt').lean();
  const updatedAt = new Date(Math.max(Date.now(), new Date(current?.updatedAt || 0).getTime() + 1));
  const condition = expectedUpdatedAt === undefined
    ? { 'confirmationReceipts.0': { $exists: false } }
    : { updatedAt: expectedUpdatedAt === null ? { $exists: false } : new Date(expectedUpdatedAt) };
  try {
    const saved = await model.findOneAndUpdate({ uid, ...condition }, { $set: { ...fields, updatedAt }, ...(!current ? { $setOnInsert: { createdAt: updatedAt } } : {}) }, {
      new: true, upsert: expectedUpdatedAt === null || expectedUpdatedAt === undefined, runValidators: true, timestamps: false,
    }).select('+phone +dateOfBirth +gender');
    if (!saved) throw campusError(409, 'PROFILE_CONFLICT', '资料已在其他页面更新，请保留当前修改并重新核对。');
    return saved;
  } catch (error) {
    if (error.code !== 11000) throw error;
    throw campusError(409, 'PROFILE_CONFLICT', '资料已在其他页面更新，请保留当前修改并重新核对。');
  }
}

export function profileJson(record) {
  if (!record) return null;
  const value = typeof record.toObject === 'function' ? record.toObject() : record;
  const { confirmationReceipts, discoveryPrivateFields, ...profile } = value;
  const known = profile.collegeStudentKnown === true || profile.collegeStudent === true;
  return { ...profile, collegeStudent: known ? profile.collegeStudent ?? null : null, collegeStudentKnown: known };
}

export function privateProfileFields(profile) {
  return profile?.discoveryPrivateFields || (profile?.confirmationReceipts?.length ? ['collegeStudent', 'collegeStudentKnown', 'education'] : []);
}

export function publicProfileJson(record) {
  const value = typeof record.toObject === 'function' ? record.toObject() : record;
  const profile = profileJson(value);
  const privateFields = privateProfileFields(value);
  for (const key of privateFields) delete profile[key];
  return profile;
}
