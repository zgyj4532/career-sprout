import express from 'express';
import multer from 'multer';
import { verifyToken } from '../middleware/auth.js';
import { extractAIProvider } from '../middleware/aiKey.js';
import { ApiError, asyncHandler as middlewareHandler } from '../middleware/errorHandler.js';
import { accountWriteHandler as asyncHandler } from '../campus/accountWrites.js';
import Interview from '../models/Interview.model.js';
import {
    generateInterviewQuestions,
    generateCodingQuestion,
    generateWarmupQuestions,
    analyzeAnswer,
    getQuestionsFromBank,
    transcribeAudio,
    runCodeAgainstTests
} from '../services/interviewService.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { validate } from '../middleware/validate.js';
import {
    startInterviewSchema,
    submitAnswerSchema,
    transcribeAudioSchema,
    parseJdSchema,
    annotateSchema,
    runCodeSchema
} from '../schemas/interview.schema.js';
import { parseJdFromUrl, parseJdFromText } from '../services/jdParser.service.js';
import { uploadAudioBuffer } from '../services/upload.service.js';
import { ownedSource } from '../campus/targets.js';
import { visibleJob } from '../campus/growth.js';
import { readFreshProfile } from '../campus/profileRead.js';
import { campusError } from '../campus/errors.js';
import { logEvent } from '../utils/diagnostics.js';
import { persistInterviewAnswer, cancelExpiredGeneration } from '../services/interviewAnswers.js';
import { speechAdmission } from '../middleware/speechAdmission.js';
import { z } from 'zod';
import { firstDiscoveryQuestion } from '../services/discoveryService.js';
import { completeInterview, continueDiscovery, ownedInterview } from '../services/interviewWorkflow.js';
import { SCORE_VERSION, answerObservations, normalizeAnalysisScores, sessionJson, groupedAnalytics } from '../services/interviewScoring.js';
import { confirmationSchema, confirmationView, confirmDiscovery } from '../campus/discoveryConfirmation.js';
import { CampusDiscoveryConfirmation } from '../campus/models.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Multer for audio uploads (memory storage — we stream to Cloudinary directly)
// ---------------------------------------------------------------------------
const audioUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 12, fieldSize: 100000, parts: 13 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('audio/')) {
            return cb(campusError(400, 'INVALID_AUDIO', '请选择音频文件。'));
        }
        cb(null, true);
    }
});

// ---------------------------------------------------------------------------
// Analytics compares only compatible formal-interview scoring scopes.
// ---------------------------------------------------------------------------
const buildInterviewAnalytics = async (uid) => groupedAnalytics(await Interview.find({ userId: uid, status: 'completed', purpose: { $ne: 'discovery' } }).sort({ completedAt: 1 }).lean());

const sessionProvider = middlewareHandler(async (req, res, next) => {
    const session = await ownedInterview(req.params.id, req.user.uid);
    const savingDiscovery = req.path.endsWith('/answer') && session.purpose === 'discovery';
    const emptyDiscovery = req.path.endsWith('/complete') && session.purpose === 'discovery' && !session.answers.length;
    const hasQuestion = req.path.endsWith('/continue') && (session.questions.some((question) => !session.answers.some((answer) => answer.questionId === question.questionId)) || session.answers.length >= session.totalQuestionCount);
    if (savingDiscovery || emptyDiscovery || hasQuestion || session.status === 'completed') return next();
    return extractAIProvider(req, res, next);
});

router.post('/discovery/start', verifyToken, aiRateLimiter, validate(z.object({ questionCount: z.number().int().min(2).max(20).default(6), language: z.string().min(2).max(10).default('zh') }).strict()), asyncHandler(async (req, res) => {
    const session = await Interview.create({ userId: req.user.uid, purpose: 'discovery', jobRole: '兴趣与经历交流', industry: '交流', experienceLevel: 'unknown', language: req.body.language, mode: 'behavioral', totalQuestionCount: req.body.questionCount, questions: [{ questionId: 'discovery-first', question: firstDiscoveryQuestion, type: 'discovery', difficulty: 'easy' }] });
    res.json({ success: true, data: sessionJson(session) });
}));
router.post('/:id([0-9a-fA-F]{24})/continue', verifyToken, sessionProvider, aiRateLimiter, asyncHandler(async (req, res) => {
    res.json({ success: true, data: sessionJson(await continueDiscovery(req.params.id, req.user.uid, req.aiProvider)) });
}));
router.get('/:id([0-9a-fA-F]{24})/profile-confirmation', verifyToken, asyncHandler(async (req, res) => {
    res.json({ success: true, data: await confirmationView(await ownedInterview(req.params.id, req.user.uid)) });
}));
router.post('/:id([0-9a-fA-F]{24})/profile-confirmation', verifyToken, validate(confirmationSchema), asyncHandler(async (req, res) => {
    res.json({ success: true, data: await confirmDiscovery(await ownedInterview(req.params.id, req.user.uid), req.body) });
}));

// ---------------------------------------------------------------------------
// POST /api/interview/start
// ---------------------------------------------------------------------------
router.post('/start', verifyToken, extractAIProvider, aiRateLimiter, validate(startInterviewSchema), asyncHandler(async (req, res) => {
    const freshProfile = await readFreshProfile(req.user.uid);
    if (req.body.resumeId) {
        const source = await ownedSource(req.body.resumeId, req.user.uid);
        if (req.body.resumeRevision !== undefined && req.body.resumeRevision !== source.revision) throw campusError(409, 'SOURCE_CHANGED', '简历已更新，请重新确认要使用的版本。');
        const missingSkills = (source.preferences?.skills || []).filter((skill) => !source.originalText.includes(skill));
        req.body.resumeText = [source.originalText, missingSkills.length ? `技能：${missingSkills.join('、')}` : ''].filter(Boolean).join('\n\n');
    } else if (!req.body.resumeText && freshProfile?.skills?.length) {
        req.body.resumeText = freshProfile.skills.join('、');
    }
    if (req.body.jobId) {
        const job = await visibleJob(req.body.jobId, req.user.uid);
        req.body.jobDescriptionText = job.description;
        req.body.jobRole = job.title;
    }
    const resolved = startInterviewSchema.safeParse(req.body);
    if (!resolved.success) throw campusError(422, 'INTERVIEW_CONTEXT_TOO_LONG', '所选简历或岗位内容超过面试输入上限，请精简后重试；原文未更改。');
    req.body = resolved.data;
    const {
        jobRole,
        industry,
        experienceLevel,
        questionCount,
        resumeText,
        mode = 'behavioral',
        language = 'en',
        companyName,
        companyRole,
        codingLanguage = 'javascript',
        jobDescriptionText,
        skipWarmup = false
    } = req.body;

    if (!jobRole || !industry || !experienceLevel) {
        throw new ApiError(400, 'Job role, industry, and experience level are required');
    }

    const count = Math.min(Math.max(parseInt(questionCount) || 10, 2), 20);
    const preferences = {
        jobRole, industry, experienceLevel, language, resumeText, jobDescriptionText, mode
    };

    let questions;
    let codingQuestion = null;

    if (mode === 'coding') {
        const cq = await generateCodingQuestion(
            { ...preferences, codingLanguage },
            req.aiProvider
        );
        questions = [cq];
        codingQuestion = cq.coding;
    } else {
        // Try company bank first, fall back to LLM generation
        const roleForBank = companyRole || jobRole;
        const banked = companyName
            ? await getQuestionsFromBank({
                companyName, role: roleForBank, experienceLevel, count
            })
            : null;

        if (banked && banked.length) {
            questions = banked;
        } else {
            questions = await generateInterviewQuestions(
                { ...preferences, questionCount: 1 },
                req.aiProvider
            );
        }
    }

    const interview = new Interview({
        userId: req.user.uid,
        purpose: 'interview', scoreVersion: SCORE_VERSION,
        jobRole,
        industry,
        experienceLevel,
        mode,
        language,
        companyName: companyName || '',
        companyRole: companyRole || '',
        jobDescriptionText: jobDescriptionText || '',
        resumeText: resumeText || '',
        questions,
        totalQuestionCount: count,
        contextSummary: '',
        status: 'in_progress',
        startedAt: new Date(),
        providerHistory: req.aiProviderSource ? [{
            provider: req.aiProvider.providerName,
            model: req.aiProvider.modelName || '',
            action: 'start',
            timestamp: new Date()
        }] : []
    });

    if (req.body.resumeId && req.body.resumeRevision !== undefined && (await ownedSource(req.body.resumeId, req.user.uid)).revision !== req.body.resumeRevision) throw campusError(409, 'SOURCE_CHANGED', '生成期间简历已更新，请重新确认版本。');
    await interview.save();

    res.json({
        success: true,
        data: {
            interviewId: interview._id,
            purpose: 'interview', scoreVersion: SCORE_VERSION,
            questions: interview.questions,
            codingQuestion,
            totalQuestionCount: interview.totalQuestionCount,
            mode,
            language
        },
        provider: req.aiProvider.providerName,
        providerSource: req.aiProviderSource
    });
}));

// ---------------------------------------------------------------------------
// POST /api/interview/warmup-questions
// ---------------------------------------------------------------------------
router.post('/warmup-questions', verifyToken, extractAIProvider, aiRateLimiter, asyncHandler(async (req, res) => {
    const { jobRole = 'this role', industry = 'technology', language = 'en' } = req.body || {};
    const questions = await generateWarmupQuestions(
        { jobRole, industry, language },
        req.aiProvider
    );
    res.json({ success: true, data: { questions } });
}));

// ---------------------------------------------------------------------------
// POST /api/interview/transcribe  (multipart; audio file + language)
// ---------------------------------------------------------------------------
router.post(
    '/transcribe',
    verifyToken,
    extractAIProvider,
    aiRateLimiter,
    speechAdmission(audioUpload.single('audio'), async (req, res) => {
        if (!req.file?.buffer?.length) {
            throw new ApiError(400, 'audio file is required');
        }
        const parsed = transcribeAudioSchema.safeParse(req.body || {});
        if (!parsed.success) throw campusError(400, 'INVALID_LANGUAGE', '语音语言设置不正确。');
        const language = parsed.data.language;
        logEvent('asr.started', { requestId: req.requestId, bytes: req.file.size });
        const result = await transcribeAudio(
            {
                audioBuffer: req.file.buffer,
                mimeType: req.file.mimetype,
                language, signal: req.speechSignal, requestId: req.requestId,
            },
            req.aiProvider
        );
        logEvent('asr.completed', { requestId: req.requestId });
        if (!req.speechSignal.aborted) res.json({ success: true, data: result });
    })
);

// ---------------------------------------------------------------------------
// POST /api/interview/parse-jd  (URL or pasted text)
// ---------------------------------------------------------------------------
router.post('/parse-jd', verifyToken, validate(parseJdSchema), asyncHandler(async (req, res) => {
    const { url, text } = req.body;
    const result = url ? await parseJdFromUrl(url) : await parseJdFromText(text);
    res.json({ success: true, data: result });
}));

// ---------------------------------------------------------------------------
// POST /api/interview/:id/answer  (multipart; transcript + optional audio + optional code)
// ---------------------------------------------------------------------------
router.post(
    '/:id([0-9a-fA-F]{24})/answer',
    verifyToken,
    sessionProvider,
    aiRateLimiter,
    audioUpload.single('audio'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;
        // Body is multipart — fields are strings; coerce & validate manually
        const body = {
            questionId: req.body.questionId,
            transcript: req.body.transcript,
            duration: req.body.duration ? Number(req.body.duration) : 0,
            code: req.body.code || null,
            codingLanguage: req.body.codingLanguage || undefined,
            isWarmup: req.body.isWarmup === 'true' || req.body.isWarmup === true,
            expressionMetrics: req.body.expressionMetrics ? safeJsonParse(req.body.expressionMetrics) : undefined
        };

        const parsed = submitAnswerSchema.safeParse(body);
        if (!parsed.success) {
            throw new ApiError(400, 'Validation failed: ' + parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
        }
        const data = parsed.data;

        const interview = await Interview.findOne({ _id: id, userId: req.user.uid });
        if (!interview) {
            throw new ApiError(404, 'Interview not found');
        }

        if (interview.status !== 'in_progress') {
            throw campusError(409, 'INTERVIEW_CLOSED', '面试已结束，不能继续提交回答。');
        }

        if (interview.answers.length >= interview.totalQuestionCount) throw campusError(409, 'INTERVIEW_LIMIT', '本次回答已保存完毕，请查看反馈。');
        const question = interview.questions.find((q) => q.questionId === data.questionId);
        if (!question) {
            throw new ApiError(404, 'Question not found');
        }

        const existingAnswer = interview.answers.find((a) => a.questionId === data.questionId);
        if (existingAnswer) {
            throw campusError(409, 'ANSWER_ALREADY_SUBMITTED', '该问题的回答已保存，请刷新面试状态。');
        }

        if (interview.purpose === 'discovery') {
            if (interview.answers.length >= interview.totalQuestionCount || data.transcript.length > 4000 || interview.answers.reduce((sum, answer) => sum + answer.transcript.length, 0) + data.transcript.length > 40000) throw campusError(422, 'DISCOVERY_LIMIT', '这次交流已到内容上限，请结束并查看整理结果。');
            const saved = await persistInterviewAnswer({ id, userId: req.user.uid, questionId: data.questionId, answerCount: interview.answers.length, update: { $push: { answers: { questionId: data.questionId, question: question.question, transcript: data.transcript, duration: data.duration } } } });
            return res.json({ success: true, data: { questionId: data.questionId, purpose: 'discovery', answeredCount: saved.answers.length, totalQuestions: saved.totalQuestionCount, questions: saved.questions, nextQuestion: null } });
        }
        // Skip scoring entirely for warmup answers
        if (data.isWarmup && process.env.APP_PROFILE !== 'campus-local') {
            const answer = {
                questionId: data.questionId,
                question: question.question,
                transcript: data.transcript,
                duration: data.duration,
                expressionMetrics: data.expressionMetrics || {},
                submittedAt: new Date(),
                audioUrl: req.file ? (await uploadAudioBuffer(req.file)).secure_url : ''
            };
            const saved = await persistInterviewAnswer({ id, userId: req.user.uid, questionId: data.questionId, answerCount: interview.answers.length, update: { $push: { answers: answer } } });
            return res.json({
                success: true,
                data: { questionId: data.questionId, isWarmup: true, answeredCount: saved.answers.length, totalQuestions: saved.totalQuestionCount }
            });
        }

        let analysis = await analyzeAnswer(
            question.question,
            data.transcript,
            data.duration,
            req.aiProvider,
            interview.contextSummary,
            interview.answers.length + 1,
            interview.totalQuestionCount,
            { language: interview.language, code: data.code, codingLanguage: data.codingLanguage, resumeText: interview.resumeText, jobDescriptionText: interview.jobDescriptionText, mode: interview.mode }
        );
        if (interview.scoreVersion === SCORE_VERSION) analysis = normalizeAnalysisScores(analysis);
        const hasPendingQuestion = interview.questions.some((item) => item.questionId !== data.questionId && !interview.answers.some((answer) => answer.questionId === item.questionId));
        if (interview.mode !== 'coding' && interview.answers.length + 1 < interview.totalQuestionCount && !hasPendingQuestion && (typeof analysis.nextQuestion?.question !== 'string' || !analysis.nextQuestion.question.trim() || analysis.nextQuestion.question.length > 2000)) throw campusError(502, 'INTERVIEW_GENERATION_FAILED', '下一题未能可靠生成，当前文字仍保留，请重试保存。');

        // Upload audio to Cloudinary if present
        let audioUrl = '';
        if (req.file && process.env.APP_PROFILE !== 'campus-local') {
            try {
                const uploadResult = await uploadAudioBuffer(req.file);
                audioUrl = uploadResult.secure_url || '';
            } catch (e) {
                logEvent('audio.upload_failed');
            }
        }

        const answer = {
            questionId: data.questionId,
            question: question.question,
            transcript: data.transcript,
            duration: data.duration,
            analysis,
            expressionMetrics: process.env.APP_PROFILE === 'campus-local' ? {} : data.expressionMetrics || {},
            ...(interview.scoreVersion === SCORE_VERSION ? { observations: answerObservations(analysis, process.env.APP_PROFILE === 'campus-local' ? null : data.expressionMetrics) } : {}),
            submittedAt: new Date(),
            code: data.code || '',
            audioUrl
        };

        const update = { $push: { answers: answer }, $set: {} };
        if (analysis.newContextSummary) update.$set.contextSummary = analysis.newContextSummary;

        let nextQuestion = null;
        if (analysis.nextQuestion && interview.answers.length + 1 < interview.totalQuestionCount) {
            nextQuestion = {
                questionId: `q_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
                question: analysis.nextQuestion.question,
                type: analysis.nextQuestion.type,
                difficulty: analysis.nextQuestion.difficulty,
                source: analysis.nextQuestion.source || 'context'
            };
            update.$push.questions = nextQuestion;
        }

        const saved = await persistInterviewAnswer({ id, userId: req.user.uid, questionId: data.questionId, answerCount: interview.answers.length, update });
        logEvent('interview.answer_saved', { count: saved.answers.length });

        res.json({
            success: true,
            data: {
                questionId: data.questionId,
                analysis,
                answeredCount: saved.answers.length,
                totalQuestions: saved.totalQuestionCount,
                nextQuestion,
                questions: saved.questions
            },
            provider: req.aiProvider.providerName,
            providerSource: req.aiProviderSource
        });
    })
);

router.post('/:id/answer', verifyToken, asyncHandler(async (req, res) => {
    throw new ApiError(400, 'Invalid interview ID format');
}));

// ---------------------------------------------------------------------------
// POST /api/interview/:id/annotate/:answerId
// ---------------------------------------------------------------------------
router.post('/:id([0-9a-fA-F]{24})/annotate/:answerId', verifyToken, validate(annotateSchema), asyncHandler(async (req, res) => {
    const { id, answerId } = req.params;
    const interview = await Interview.findOne({ _id: id, userId: req.user.uid });
    if (!interview) throw new ApiError(404, 'Interview not found');
    const answer = interview.answers.id(answerId);
    if (!answer) throw new ApiError(404, 'Answer not found');
    answer.annotations.push({ text: req.body.annotation });
    await interview.save();
    res.json({ success: true, data: { answerId, annotations: answer.annotations } });
}));

// ---------------------------------------------------------------------------
// POST /api/interview/:id/run-code
// ---------------------------------------------------------------------------
router.post('/:id([0-9a-fA-F]{24})/run-code', verifyToken, extractAIProvider, aiRateLimiter, validate(runCodeSchema), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { code, language, problemId } = req.body;

    const interview = await Interview.findOne({ _id: id, userId: req.user.uid });
    if (!interview) throw new ApiError(404, 'Interview not found');

    const codingQ = interview.questions.find((q) =>
        (!problemId || q.questionId === problemId) && q.coding
    );
    if (!codingQ || !codingQ.coding) {
        throw new ApiError(400, 'No coding question found in this interview');
    }

    const results = await runCodeAgainstTests(
        {
            code,
            language,
            problemStatement: codingQ.coding.problemStatement,
            testCases: codingQ.coding.testCases
        },
        req.aiProvider
    );
    res.json({ success: true, data: results });
}));

// ---------------------------------------------------------------------------
// POST /api/interview/:id/switch-provider
// ---------------------------------------------------------------------------
router.post('/:id([0-9a-fA-F]{24})/switch-provider', verifyToken, extractAIProvider, aiRateLimiter, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const interview = await Interview.findOne({ _id: id, userId: req.user.uid });
    if (!interview) throw new ApiError(404, 'Interview not found');
    if (interview.purpose === 'discovery' || interview.status !== 'in_progress' || interview.generation?.status === 'pending') throw campusError(409, 'INTERVIEW_CLOSED', '当前记录不能重新评分。');

    const lastAnswer = interview.answers[interview.answers.length - 1];
    if (!lastAnswer) {
        throw new ApiError(400, 'No previous answer to re-analyze');
    }

    const lastQuestion = interview.questions.find((q) => q.questionId === lastAnswer.questionId);
    if (!lastQuestion) {
        throw new ApiError(404, 'Question not found');
    }

    let reAnalysis = await analyzeAnswer(
        lastQuestion.question,
        lastAnswer.transcript,
        lastAnswer.duration,
        req.aiProvider,
        interview.contextSummary,
        interview.answers.length,
        interview.totalQuestionCount,
        { language: interview.language, code: lastAnswer.code, codingLanguage: lastAnswer.codingLanguage }
    );
    if (interview.scoreVersion === SCORE_VERSION) reAnalysis = normalizeAnalysisScores(reAnalysis);

    const set = { 'answers.$.analysis': reAnalysis };
    if (interview.scoreVersion === SCORE_VERSION) set['answers.$.observations'] = answerObservations(reAnalysis, lastAnswer.expressionMetrics);
    if (reAnalysis.newContextSummary) set.contextSummary = reAnalysis.newContextSummary;
    const changed = await Interview.updateOne({ _id: id, userId: req.user.uid, status: 'in_progress', 'generation.status': { $ne: 'pending' }, updatedAt: interview.updatedAt, 'answers._id': lastAnswer._id }, {
        $set: set, $push: { providerHistory: { provider: req.aiProvider.providerName, model: req.aiProvider.modelName || '', action: 'switch', timestamp: new Date() } },
    }, { runValidators: true });
    if (!changed.matchedCount) throw campusError(409, 'INTERVIEW_CHANGED', '进度已更新，请恢复进度，不会覆盖已生成的反馈。');

    res.json({
        success: true,
        data: {
            questionId: lastAnswer.questionId,
            analysis: reAnalysis,
            provider: req.aiProvider.providerName
        },
        provider: req.aiProvider.providerName,
        providerSource: req.aiProviderSource
    });
}));

// ---------------------------------------------------------------------------
// POST /api/interview/:id/complete
// ---------------------------------------------------------------------------
router.post('/:id([0-9a-fA-F]{24})/complete', verifyToken, sessionProvider, aiRateLimiter, asyncHandler(async (req, res) => {
    const session = await completeInterview(req.params.id, req.user.uid, req.aiProvider);
    res.json({ success: true, data: { ...sessionJson(session), answeredQuestions: session.answers.length, totalQuestions: session.totalQuestionCount } });
}));

router.post('/:id/complete', verifyToken, asyncHandler(async (req, res) => {
    throw new ApiError(400, 'Invalid interview ID format');
}));

// ---------------------------------------------------------------------------
// GET /api/interview/history
// ---------------------------------------------------------------------------
router.get('/history', verifyToken, asyncHandler(async (req, res) => {
    const interviews = await Interview.find({ userId: req.user.uid })
        .sort({ createdAt: -1 })
        .limit(50)
        .select('title jobRole purpose mode scoreVersion scoring status overallScore createdAt completedAt totalQuestionCount answers.questionId generation')
        .lean();

    res.json({
        success: true,
        data: interviews.map((row) => ({
            _id: row._id,
            title: row.title || '',
            jobRole: row.jobRole,
            status: row.status,
            purpose: row.purpose || 'interview', mode: row.mode, scoreVersion: row.purpose === 'discovery' ? null : row.scoreVersion || 'legacy', scoring: row.purpose === 'discovery' ? null : row.scoring || null,
            overallScore: row.purpose === 'discovery' ? null : row.overallScore ?? null,
            createdAt: row.createdAt,
            completedAt: row.completedAt,
            totalQuestionCount: row.totalQuestionCount,
            answeredCount: row.answers?.length || 0,
        })),
    });
}));

router.patch('/:id([0-9a-fA-F]{24})', verifyToken, asyncHandler(async (req, res) => {
    const title = String(req.body?.title || '').replace(/\s+/g, ' ').trim();
    if (!title || title.length > 40) {
        throw new ApiError(400, '档案名字需要 1 到 40 个字');
    }
    const interview = await Interview.findOneAndUpdate(
        { _id: req.params.id, userId: req.user.uid },
        { $set: { title } },
        { new: true },
    ).select('title');
    if (!interview) throw new ApiError(404, '找不到这份档案');
    res.json({ success: true, data: { title: interview.title } });
}));

router.delete('/:id([0-9a-fA-F]{24})', verifyToken, asyncHandler(async (req, res) => {
    await cancelExpiredGeneration(req.params.id, req.user.uid);
    const pending = await CampusDiscoveryConfirmation.exists({ interviewId: req.params.id, userId: req.user.uid, status: { $ne: 'completed' } });
    if (pending) throw campusError(409, 'CONFIRMATION_PENDING', '资料确认还未完成，请先恢复保存，避免丢失恢复依据。');
    const deleted = await Interview.findOneAndDelete({ _id: req.params.id, userId: req.user.uid, confirmationPending: { $ne: true }, 'generation.status': { $ne: 'pending' } });
    if (!deleted) {
        if (await Interview.exists({ _id: req.params.id, userId: req.user.uid })) throw campusError(409, 'GENERATION_PENDING', '内容正在生成，请结束后删除。');
        throw new ApiError(404, '找不到这份档案');
    }
    await CampusDiscoveryConfirmation.deleteOne({ interviewId: req.params.id, userId: req.user.uid });
    res.json({ success: true });
}));

// ---------------------------------------------------------------------------
// GET /api/interview/analytics
// ---------------------------------------------------------------------------
router.get('/analytics', verifyToken, asyncHandler(async (req, res) => {
    const analytics = await buildInterviewAnalytics(req.user.uid);

    res.json({
        success: true,
        data: analytics
    });
}));

// ---------------------------------------------------------------------------
// GET /api/interview/:id
// ---------------------------------------------------------------------------
router.get('/:id([0-9a-fA-F]{24})', verifyToken, asyncHandler(async (req, res) => {
    const { id } = req.params;

    const interview = await Interview.findOne({ _id: id, userId: req.user.uid }).lean();
    if (!interview) {
        throw new ApiError(404, `Interview not found id=${id}`);
    }

    res.json({
        success: true,
        data: sessionJson(interview)
    });
}));

router.get('/:id', verifyToken, asyncHandler(async (req, res) => {
    throw new ApiError(400, 'Invalid interview ID format');
}));

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
function safeJsonParse(value) {
    try {
        return typeof value === 'string' ? JSON.parse(value) : value;
    } catch {
        return undefined;
    }
}

export default router;
