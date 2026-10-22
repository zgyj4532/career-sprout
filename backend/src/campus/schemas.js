import { z } from 'zod';

export const objectId = z.string().regex(/^[a-fA-F0-9]{24}$/);
const text = (max) => z.string().trim().max(max);
export const operationIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/).optional();
export const expectedUpdatedAtSchema = z.string().datetime().nullable().optional();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => { const parsed = new Date(`${value}T00:00:00Z`); return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value; }).nullable().default(null);
export const availabilitySchema = z.object({ startDate: date, endDate: date, daysPerWeek: z.number().int().min(1).max(7).nullable().default(null) }).strict().refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, '开始日期不能晚于结束日期');
export const normalizeSkill = (value) => value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
const uniqueSkills = (items) => new Set(items.map((item) => normalizeSkill(item.name))).size === items.length;
export const requirementsSchema = z.array(z.object({ name: text(80).min(1), level: z.number().int().min(0).max(3), required: z.boolean(), evidence: text(1000).default('') }).strict()).max(50).refine(uniqueSkills, '技能名称重复');
export const studentSchema = z.object({
  expectedUpdatedAt: expectedUpdatedAtSchema,
  interests: z.array(text(80).min(1)).max(20).optional(),
  experiences: z.array(z.object({
    id: text(80).min(1), kind: z.enum(['course', 'club', 'project', 'internship', 'other']), title: text(150).min(1),
    context: text(2000).default(''), actions: text(3000).default(''), result: text(2000).default(''),
    organization: text(150).optional(), sourceBlockId: text(80).optional(),
    fullText: z.string().max(100000).optional(), brief: z.string().max(3000).optional(),
    useConcise: z.boolean().optional(),
    titleIsSourceExcerpt: z.boolean().optional(),
    state: z.enum(['idea', 'in_progress', 'completed']).optional(),
    sourceConversationId: text(80).optional(), sourceQuestionId: text(100).optional(),
    dateText: z.string().max(80).optional(), precision: z.string().max(20).optional(), current: z.boolean().optional(),
  }).strict()).max(30).refine((items) => new Set(items.map((item) => item.id)).size === items.length).optional(),
  otherMaterials: z.string().max(20000).optional(),
  importedEducation: z.array(z.object({
    id: z.string().max(80).optional(), fullText: z.string().max(100000).optional(),
    institution: z.string().max(150).optional(), degree: z.string().max(100).optional(), field: z.string().max(100).optional(),
    startYear: z.number().int().min(1900).max(2100).optional(), endYear: z.number().int().min(1900).max(2100).optional(),
    dateText: z.string().max(80).optional(), precision: z.enum(['day', 'month', 'year', 'unknown', '']).optional(), current: z.boolean().optional(),
  }).strict()).max(20).optional(),
  skillAssessments: z.array(z.object({ name: text(80).min(1), level: z.number().int().min(0).max(3).nullable().optional(), evidence: text(1000).default('') }).strict()).max(50).refine(uniqueSkills).optional(),
  availability: availabilitySchema.optional(), targetJobId: objectId.nullable().optional(),
}).strict();
export const jobSchema = z.object({ company: text(150).min(1), title: text(150).min(1), description: text(20000).min(1), source: text(500).default(''), authorKind: z.enum(['student', 'alumni', 'teacher']).default('student'), availability: availabilitySchema.default({ startDate: null, endDate: null, daysPerWeek: null }), requirements: requirementsSchema.default([]), status: z.enum(['draft', 'published']).default('draft'), operationId: operationIdSchema }).strict();
export const jobPatchSchema = jobSchema.partial().extend({ expectedUpdatedAt: expectedUpdatedAtSchema });
export const analyzeSchema = z.object({ description: text(20000).min(1) }).strict();
export const polishSchema = z.object({ sourceText: text(20000).min(1), jobId: objectId.optional() }).strict();
export const polishResultSchema = z.object({ draft: text(20000).min(1), changes: z.array(text(500)).max(30), questions: z.array(text(500)).max(20) }).strict();
export const targetCreateSchema = z.object({ jobId: objectId }).strict();
export const revisionSchema = z.object({ revision: z.number().int().positive() }).strict();
export const targetEditSchema = revisionSchema.extend({ draft: text(20000).min(1) });
export const grantSchema = z.object({ teacherId: z.string().regex(/^user_[a-zA-Z0-9]{1,100}$/) }).strict();
export const exportSchema = z.object({ targetIds: z.array(objectId).min(1).max(20).refine((ids) => new Set(ids).size === ids.length) }).strict();

export const interviewPrepSchema = z.object({
  jobRole: text(150).default(''), manualRole: text(150).default(''),
  mode: z.enum(['mixed', 'technical', 'behavioral']).default('mixed'), count: z.number().int().min(1).max(20).default(4),
  resumeId: objectId.nullable().default(null), text: z.string().max(100000).default(''),
  jobId: objectId.nullable().default(null), savedJobTitle: text(150).default(''),
}).strict();
