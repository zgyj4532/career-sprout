import mongoose from 'mongoose';

const availability = new mongoose.Schema({ startDate: { type: String, default: null }, endDate: { type: String, default: null }, daysPerWeek: { type: Number, default: null } }, { _id: false });
const assessment = new mongoose.Schema({ name: String, level: { type: Number, min: 0, max: 3 }, evidence: { type: String, default: '' } }, { _id: false });
const experienceSchema = new mongoose.Schema({
  id: String, kind: String, title: String, context: String, actions: String, result: String,
  fullText: { type: String, default: '' }, brief: { type: String, default: '' },
  dateText: { type: String, default: '' }, precision: { type: String, default: '' }, current: { type: Boolean, default: false },
  organization: { type: String, default: '' }, sourceBlockId: String,
  useConcise: { type: Boolean, default: false },
  titleIsSourceExcerpt: { type: Boolean, default: false },
  state: { type: String, enum: ['idea', 'in_progress', 'completed'] },
  sourceConversationId: String, sourceQuestionId: String,
}, { _id: false });
const studentSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  interests: { type: [String], default: [] },
  experiences: { type: [experienceSchema], default: [] },
  otherMaterials: { type: String, default: '' },
  lastImportId: String,
  confirmationReceipts: { type: [String], default: [] },
  importedEducation: { type: [new mongoose.Schema({
    id: String, institution: String, degree: String, field: String, startYear: Number, endYear: Number,
    dateText: String, precision: String, current: Boolean, fullText: String,
  }, { _id: false })], default: [] },
  skillAssessments: { type: [assessment], default: [] },
  availability: { type: availability, default: () => ({}) },
  targetJobId: { type: mongoose.Schema.Types.ObjectId, default: null },
}, { timestamps: true });
const jobSchema = new mongoose.Schema({
  creatorUid: { type: String, required: true, index: true },
  authorKind: { type: String, enum: ['student', 'alumni', 'teacher'], required: true },
  company: String, title: String, description: String, source: String,
  availability: { type: availability, default: () => ({}) },
  requirements: { type: [new mongoose.Schema({ name: String, level: Number, required: Boolean, evidence: String }, { _id: false })], default: [] },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  saveReceipts: { type: [String], default: [] },
}, { timestamps: true });
jobSchema.index({ status: 1, createdAt: -1 });
const grantSchema = new mongoose.Schema({
  studentId: { type: String, required: true }, teacherId: { type: String, required: true }, grantedAt: { type: Date, default: Date.now },
});
grantSchema.index({ studentId: 1, teacherId: 1 }, { unique: true });
grantSchema.index({ teacherId: 1, studentId: 1 });
const targetSchema = new mongoose.Schema({
  studentId: { type: String, required: true, index: true },
  sourceResumeId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sourceRevision: { type: Number, required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  jobRevision: { type: Date, default: null },
  title: String, company: String, draft: { type: String, required: true },
  revision: { type: Number, default: 1 }, approvedRevision: { type: Number, default: null },
  changes: [String], questions: [String],
}, { timestamps: true });
const tombstoneSchema = new mongoose.Schema({
  resumeId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  deletedAt: { type: Date, default: Date.now },
});
const importDraftSchema = new mongoose.Schema({
  userId: { type: String, required: true, index: true },
  purpose: { type: String, enum: ['resume', 'job'], default: 'resume' },
  files: { type: [new mongoose.Schema({ id: String, filePath: String, mime: String, bytes: Number, kind: String }, { _id: false })], default: [] },
  status: { type: String, default: 'received' },
  phase: { type: String, default: '文件已收好' },
  filePath: String,
  bytes: { type: Number, default: 0 },
  reservedBytes: { type: Number, default: 0 },
  mime: String,
  kind: String,
  filename: String,
  uploadComplete: { type: Boolean, default: false },
  parseComplete: { type: Boolean, default: false },
  issues: { type: Array, default: [] },
  modelState: { type: mongoose.Schema.Types.Mixed, default: {} },
  errorCode: String,
  leaseToken: String,
  leaseUntil: Date,
  blocks: { type: Array, default: [] },
  result: { type: mongoose.Schema.Types.Mixed, default: null },
  resumeId: { type: mongoose.Schema.Types.ObjectId, default: null },
  quotaOperationId: String,
  expectedBytes: Number,
}, { timestamps: true });
const confirmLedgerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  draftId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  frozen: { type: mongoose.Schema.Types.Mixed, required: true },
  leaseUntil: Date,
  leaseToken: String,
  errorCode: String,
  restoredAt: Date,
  status: { type: String, default: 'saving' },
  steps: { type: mongoose.Schema.Types.Mixed, default: {} },
  writeStarted: { type: Boolean, default: false },
  restoreStarted: { type: Boolean, default: false },
  cachePending: { type: Boolean, default: false },
}, { timestamps: true, minimize: false });
const quotaSchema = new mongoose.Schema({
  _id: String, revision: { type: Number, default: 0 },
  holds: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { minimize: false });
const modelQuotaSchema = new mongoose.Schema({
  _id: String, operations: { type: [String], default: [] },
}, { timestamps: true });
const importSaveLockSchema = new mongoose.Schema({ _id: String, token: String, until: Date });
const interviewPrepSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  jobRole: { type: String, default: '' }, manualRole: { type: String, default: '' },
  mode: { type: String, enum: ['mixed', 'technical', 'behavioral'], default: 'mixed' },
  count: { type: Number, default: 4 }, resumeId: { type: mongoose.Schema.Types.ObjectId, default: null },
  text: { type: String, default: '' }, jobId: { type: mongoose.Schema.Types.ObjectId, default: null },
  savedJobTitle: { type: String, default: '' },
}, { timestamps: true });
const discoveryConfirmationSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  interviewId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  frozen: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, default: 'saving' },
  steps: { type: mongoose.Schema.Types.Mixed, default: {} },
  leaseToken: String, leaseUntil: Date, errorCode: String, cachePending: Boolean,
}, { timestamps: true, minimize: false });
const saveOperationSchema = new mongoose.Schema({
  userId: { type: String, required: true }, kind: { type: String, required: true },
  operationId: { type: String, required: true }, resourceId: mongoose.Schema.Types.ObjectId,
  payloadHash: String, frozen: mongoose.Schema.Types.Mixed, result: mongoose.Schema.Types.Mixed,
  status: { type: String, default: 'pending' }, leaseToken: String, leaseUntil: Date,
}, { timestamps: true, minimize: false });
saveOperationSchema.index({ userId: 1, kind: 1, operationId: 1 }, { unique: true });
const accountWriteStateSchema = new mongoose.Schema({ _id: String, epoch: { type: Number, default: 0 }, deleting: { type: Boolean, default: false } }, { versionKey: false });
export const CampusStudent = mongoose.model('CampusStudent', studentSchema);
export const CampusJob = mongoose.model('CampusJob', jobSchema);
export const CampusGrant = mongoose.model('CampusGrant', grantSchema);
export const CampusTarget = mongoose.model('CampusTarget', targetSchema);
export const CampusResumeTombstone = mongoose.model('CampusResumeTombstone', tombstoneSchema);
export const CampusImportDraft = mongoose.model('CampusImportDraft', importDraftSchema);
export const CampusConfirmLedger = mongoose.model('CampusConfirmLedger', confirmLedgerSchema);
export const CampusImportQuota = mongoose.model('CampusImportQuota', quotaSchema);
export const CampusImportModelQuota = mongoose.model('CampusImportModelQuota', modelQuotaSchema);
export const CampusInterviewPrep = mongoose.model('CampusInterviewPrep', interviewPrepSchema);
export const CampusImportSaveLock = mongoose.model('CampusImportSaveLock', importSaveLockSchema);
export const CampusDiscoveryConfirmation = mongoose.model('CampusDiscoveryConfirmation', discoveryConfirmationSchema);
export const CampusSaveOperation = mongoose.model('CampusSaveOperation', saveOperationSchema);
export const CampusAccountWriteState = mongoose.model('CampusAccountWriteState', accountWriteStateSchema);
