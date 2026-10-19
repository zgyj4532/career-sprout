import mongoose from 'mongoose';

const availability = new mongoose.Schema({ startDate: { type: String, default: null }, endDate: { type: String, default: null }, daysPerWeek: { type: Number, default: null } }, { _id: false });
const assessment = new mongoose.Schema({ name: String, level: { type: Number, min: 0, max: 3 }, evidence: { type: String, default: '' } }, { _id: false });
const studentSchema = new mongoose.Schema({
  uid: { type: String, required: true, unique: true },
  interests: { type: [String], default: [] },
  experiences: { type: [new mongoose.Schema({ id: String, kind: String, title: String, context: String, actions: String, result: String }, { _id: false })], default: [] },
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
  sourceRevision: { type: Date, required: true },
  jobId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  jobRevision: { type: Date, default: null },
  title: String, company: String, draft: { type: String, required: true },
  revision: { type: Number, default: 1 }, approvedRevision: { type: Number, default: null },
  changes: [String], questions: [String],
}, { timestamps: true });
export const CampusStudent = mongoose.model('CampusStudent', studentSchema);
export const CampusJob = mongoose.model('CampusJob', jobSchema);
export const CampusGrant = mongoose.model('CampusGrant', grantSchema);
export const CampusTarget = mongoose.model('CampusTarget', targetSchema);
