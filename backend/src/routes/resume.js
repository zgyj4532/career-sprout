import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';
import { ApiError } from '../middleware/errorHandler.js';
import { accountWriteHandler as asyncHandler } from '../campus/accountWrites.js';
import { paginate, paginatedResponse } from '../middleware/paginate.js';
import Resume from '../models/Resume.model.js';
import ResumeVersion from '../models/ResumeVersion.model.js';
import ResumeAtsHistory from '../models/ResumeAtsHistory.model.js';
import { validate } from '../middleware/validate.js';
import {
  createResumeSchema,
  updateResumeSchema,
  downloadResumeQuerySchema,
  createResumeVersionSchema,
  updateResumeVersionSchema,
  createAtsHistorySchema,
  restoreResumeSchema,
  reorderResumeSchema,
} from '../schemas/resume.schema.js';
import { scrapeLinkedInProfile, profileToResumeText } from '../services/linkedinImporter.js';
import { fetchGitHubProfile, convertGitHubToResumeText } from '../services/githubImporter.js';
import { getDefaultProvider } from '../config/aiProviders.js';
import { analyzeResume } from '../services/resumeService.js';
import { logEvent } from '../utils/diagnostics.js';
import { campusError } from '../campus/errors.js';
import { planResumeUpdate } from '../campus/resumeRevision.js';
import { withResumeAssociation, deleteResumeOwned } from '../campus/resumeDelete.js';
import { saveMaterial, recoverMaterialSave } from '../campus/materialSave.js';

const router = express.Router();

for (const name of ['resumeId', 'versionId']) router.param(name, (req, res, next, value) => {
  if (!/^[a-fA-F0-9]{24}$/.test(value)) return next(campusError(400, 'INVALID_ID', '编号格式不正确。'));
  next();
});

async function saveResumeBody(resumeId, userId, updates) {
  return withResumeAssociation(resumeId, userId, 'version', async (current) => {
    const plan = planResumeUpdate(current, updates);
    if (plan.error === 'conflict') throw campusError(409, 'REVISION_CONFLICT', '简历已在其他页面更新，请保留当前内容并刷新。');
    if (plan.error) throw new ApiError(400, 'No valid fields to update');
    const saved = await Resume.findOneAndUpdate(plan.filter, plan.update, { new: true, runValidators: true }).lean();
    if (!saved) throw campusError(409, 'REVISION_CONFLICT', '简历已在其他页面更新，请保留当前内容并刷新。');
    return saved;
  });
}

/**
 * @swagger
 * /api/resumes:
 *   get:
 *     summary: Get all resumes
 *     responses:
 *       200:
 *         description: Success
 */

router.get('/save-operations/:operationId', verifyToken, asyncHandler(async (req, res) => res.json({ success: true, data: await recoverMaterialSave('resume', req.user.uid, req.params.operationId) })));
// Get all resumes for a user (paginated)
router.get('/', verifyToken, paginate(), asyncHandler(async (req, res) => {
  const userId = req.user.uid;
  const { page, limit, skip, sort } = req.paginate;

  const total = await Resume.countDocuments({ userId, deleting: { $ne: true } });

  const userResumes = await Resume.find({ userId, deleting: { $ne: true } })
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  const resumes = userResumes.map(resume => ({
    id: resume._id.toString(),
    ...resume,
    revision: resume.revision ?? 1,
    contentRevision: resume.contentRevision ?? 1,
    _id: undefined
  }));

  paginatedResponse(res, { data: resumes, total, page, limit });
}));

/**
 * @swagger
 * /api/resumes/{resumeId}:
 *   get:
 *     summary: Get resume by ID
 *     parameters:
 *       - in: path
 *         name: resumeId
 *         required: true
 *     responses:
 *       200:
 *         description: Success
 */
// Get a specific resume
router.get('/:resumeId', verifyToken, asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  const userId = req.user.uid;

  const resume = await Resume.findOne({ _id: resumeId, userId, deleting: { $ne: true } }).lean();

  if (!resume) {
    throw new ApiError(404, 'Resume not found');
  }

  res.json({
    success: true,
    data: {
      id: resume._id.toString(),
      ...resume,
      revision: resume.revision ?? 1,
      contentRevision: resume.contentRevision ?? 1,
      _id: undefined
    }
  });
}));

/**
 * @swagger
 * /api/resumes:
 *   post:
 *     summary: Create new resume
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Created
 */ 
// Create a new resume
router.post('/', verifyToken, validate(createResumeSchema), asyncHandler(async (req, res) => {
  const userId = req.user.uid;
  if (req.body.operationId) return res.status(201).json({ success: true, data: await saveMaterial({ kind: 'resume', uid: userId, body: req.body }) });
  const {
    originalText,
    enhancedText,
    jobRole,
    preferences,
    title,
    customSections
  } = req.body;

  if (!originalText) {
    throw new ApiError(400, 'Original text is required');
  }

  const newResume = await Resume.create({
    userId,
    originalText,
    enhancedText: enhancedText || null,
    jobRole: jobRole || null,
    preferences: preferences || {},
    title: title || `Resume - ${new Date().toLocaleDateString()}`,
    customSections: Array.isArray(customSections) ? customSections : [],
  });

  try {
    await withResumeAssociation(newResume._id, userId, 'version', () => ResumeVersion.create({
      resumeId: newResume._id,
      userId,
      versionNumber: 1,
      title: 'v1 - Initial Draft',
      originalText: newResume.originalText,
      enhancedText: newResume.enhancedText,
      jobRole: newResume.jobRole,
      atsScore: newResume.atsScore !== undefined && newResume.atsScore !== null ? newResume.atsScore : null,
      tags: ['initial-draft'],
      metadata: { source: 'editor' }
    }));
  } catch (err) {
    await deleteResumeOwned(newResume._id, userId);
    throw err;
  }

  logEvent('resume.saved');
  res.status(201).json({
    success: true,
    data: {
      id: newResume._id.toString(),
      userId: newResume.userId,
      originalText: newResume.originalText,
      enhancedText: newResume.enhancedText,
      jobRole: newResume.jobRole,
      preferences: newResume.preferences,
      title: newResume.title,
      pdfUrl: newResume.pdfUrl,
      revision: newResume.revision,
      contentRevision: newResume.contentRevision,
      createdAt: newResume.createdAt,
      lastModified: newResume.lastModified
    }
  });
}));

/**
 * @swagger
 * /api/resumes/{resumeId}:
 *   put:
 *     summary: Update resume
 *     parameters:
 *       - in: path
 *         name: resumeId
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Success
 */
// Update a resume
router.put('/:resumeId', verifyToken, validate(updateResumeSchema), asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  const userId = req.user.uid;
  if (req.body.operationId) return res.json({ success: true, data: await saveMaterial({ kind: 'resume', uid: userId, id: resumeId, body: req.body }) });
  const updates = req.body;
  const updatedResume = await saveResumeBody(resumeId, userId, updates);

  logEvent('resume.saved');
  res.json({
    success: true,
    data: {
      id: updatedResume._id.toString(),
      ...updatedResume,
      _id: undefined
    }
  });
}));

/**
 * @swagger
 * /api/resumes/{resumeId}/reorder:
 *   put:
 *     summary: Reorder resume sections
 *     parameters:
 *       - in: path
 *         name: resumeId
 *         required: true
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Success
 */
// Reorder sections
router.put('/:resumeId/reorder', verifyToken, validate(reorderResumeSchema), asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  const userId = req.user.uid;
  const updatedResume = await saveResumeBody(resumeId, userId, req.body);

  res.json({
    success: true,
    data: {
      id: updatedResume._id.toString(),
      ...updatedResume,
      _id: undefined
    }
  });
}));

/**
 * @swagger
 * /api/resumes/{resumeId}:
 *   delete:
 *     summary: Delete resume
 *     parameters:
 *       - in: path
 *         name: resumeId
 *         required: true
 *     responses:
 *       200:
 *         description: Success
 */
// Delete a resume. The record is marked deleting before cleanup, and success
// is returned only after the related rows are gone. A missing resume can
// still be cleaned when this user already has a tombstone.
router.delete('/:resumeId', verifyToken, asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  const userId = req.user.uid;
  await deleteResumeOwned(resumeId, userId);
  res.json({ success: true, message: 'Resume deleted successfully' });
}));

// Preview LinkedIn profile before importing
router.post('/import/linkedin/preview', verifyToken, asyncHandler(async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    throw new ApiError(400, 'LinkedIn URL is required');
  }

  const isLinkedIn = /^https?:\/\/(www\.)?linkedin\.com\/in\//.test(url.trim());
  if (!isLinkedIn) {
    throw new ApiError(400, 'Please provide a valid LinkedIn profile URL (linkedin.com/in/...)');
  }

  const profile = await scrapeLinkedInProfile(url.trim());

  res.json({
    success: true,
    preview: {
      name: profile.name,
      headline: profile.headline,
      location: profile.location,
      about: profile.about,
      experienceCount: profile.experience?.length || 0,
      educationCount: profile.education?.length || 0,
      skills: profile.skills || [],
    },
    profile,
  });
}));

// Import LinkedIn profile as a resume
router.post('/import/linkedin', verifyToken, asyncHandler(async (req, res) => {
  const { url, profile: cachedProfile } = req.body;
  const userId = req.user.uid;

  if (!url && !(process.env.NODE_ENV === 'development' && cachedProfile)) {
    throw new ApiError(400, 'LinkedIn URL is required');
  }

  const profile = (process.env.NODE_ENV === 'development' && cachedProfile)
    ? cachedProfile
    : await scrapeLinkedInProfile(url.trim());
  const resumeText = profileToResumeText(profile);
  const title = `${profile.name || 'LinkedIn'} — Imported ${new Date().toLocaleDateString()}`;

  const resume = await Resume.create({
    userId,
    originalText: resumeText,
    jobRole: profile.headline || null,
    preferences: { skills: profile.skills || [] },
    title,
  });

  try {
    await withResumeAssociation(resume._id, userId, 'version', () => ResumeVersion.create({
      resumeId: resume._id,
      userId,
      versionNumber: 1,
      title: 'v1 - LinkedIn Import',
      originalText: resume.originalText,
      enhancedText: null,
      jobRole: resume.jobRole,
      atsScore: null,
      tags: ['linkedin-import'],
      metadata: { source: 'linkedin' }
    }));
  } catch (err) {
    await deleteResumeOwned(resume._id, userId);
    throw err;
  }

  res.status(201).json({
    success: true,
    data: {
      id: resume._id.toString(),
      userId: resume.userId,
      originalText: resume.originalText,
      enhancedText: resume.enhancedText,
      jobRole: resume.jobRole,
      preferences: resume.preferences,
      title: resume.title,
      pdfUrl: resume.pdfUrl,
      revision: resume.revision,
      contentRevision: resume.contentRevision,
      createdAt: resume.createdAt,
      lastModified: resume.lastModified,
    },
  });
}));

// Download resume as PDF
router.get('/:resumeId/download', verifyToken, validate(downloadResumeQuerySchema, 'query'), asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  const userId = req.user.uid;
  const { version = 'enhanced', paperSize = 'A4' } = req.query;

  const resume = await Resume.findById(resumeId).lean();

  if (!resume) {
    throw new ApiError(404, 'Resume not found');
  }

  if (String(resume.userId) !== String(userId)) {
    throw new ApiError(403, 'Access denied');
  }

  const textContent = version === 'enhanced' && resume.enhancedText 
    ? resume.enhancedText 
    : resume.originalText;

  if (!textContent) {
    throw new ApiError(400, 'No content available for download');
  }

  const { generatePDF } = await import('../services/pdfGenerator.js');

  const controller = new AbortController();
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.once('close', cancel);
  try {
    const pdfBuffer = await generatePDF(textContent, {
      format: paperSize === 'Letter' ? 'Letter' : 'A4',
      title: resume.title || 'Resume', signal: controller.signal, requestId: req.requestId,
    });
    if (controller.signal.aborted) return;
    const filename = `${resume.title || 'resume'}_${version}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, '_');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } finally {
    res.removeListener('close', cancel);
  }
}));

// Preview GitHub profile before importing
router.post('/import/github/preview', verifyToken, asyncHandler(async (req, res) => {
  const { username } = req.body;
  if (!username || typeof username !== 'string') {
    throw new ApiError(400, 'GitHub username is required');
  }

  let cleanUsername = username.trim();
  cleanUsername = cleanUsername.replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^@/, '');
  cleanUsername = cleanUsername.split('/')[0].trim();

  const githubToken = req.headers['x-github-token'] || null;
  const profileData = await fetchGitHubProfile(cleanUsername, githubToken);
  res.json({
    success: true,
    preview: profileData
  });
}));

// Import GitHub profile as a resume
router.post('/import/github', verifyToken, asyncHandler(async (req, res) => {
  const { username, profile: cachedProfile } = req.body;
  const userId = req.user.uid;

  if (!username && !cachedProfile) {
    throw new ApiError(400, 'GitHub username or profile data is required');
  }

  let cleanUsername = username ? username.trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/^@/, '').split('/')[0].trim() : '';
  const githubToken = req.headers['x-github-token'] || null;
  const profile = cachedProfile || await fetchGitHubProfile(cleanUsername, githubToken);
  const resumeText = convertGitHubToResumeText(profile);
  const title = `${profile.name || username} GitHub Profile — Imported ${new Date().toLocaleDateString()}`;

  const resume = await Resume.create({
    userId,
    originalText: resumeText,
    jobRole: 'Software Developer',
    preferences: { skills: profile.topLanguages || [] },
    title,
  });

  try {
    await withResumeAssociation(resume._id, userId, 'version', () => ResumeVersion.create({
      resumeId: resume._id,
      userId,
      versionNumber: 1,
      title: 'v1 - GitHub Import',
      originalText: resume.originalText,
      enhancedText: null,
      jobRole: resume.jobRole,
      atsScore: null,
      tags: ['github-import'],
      metadata: { source: 'github' }
    }));
  } catch (err) {
    await deleteResumeOwned(resume._id, userId);
    throw err;
  }

  res.status(201).json({
    success: true,
    data: {
      id: resume._id.toString(),
      userId: resume.userId,
      originalText: resume.originalText,
      enhancedText: resume.enhancedText,
      jobRole: resume.jobRole,
      preferences: resume.preferences,
      title: resume.title,
      pdfUrl: resume.pdfUrl,
      revision: resume.revision,
      contentRevision: resume.contentRevision,
      createdAt: resume.createdAt,
      lastModified: resume.lastModified,
    },
  });
}));

// Text to Resume Endpoint
router.post('/from-text', verifyToken, asyncHandler(async (req, res) => {
  const { text, jobRole } = req.body;
  const userId = req.user.uid;

  if (!text || !text.trim()) {
    throw new ApiError(400, 'Raw text is required');
  }

  // Use AI to structure raw text into a standard resume format
  const prompt = `You are an expert resume writer. Convert the following raw text into a professional, well-structured resume markdown format.
  
Target Role: ${jobRole || 'Professional'}

Rules:
1. Extract and organize information into standard sections: SUMMARY, EXPERIENCE, EDUCATION, SKILLS, PROJECTS
2. If some sections are missing, leave them out or infer appropriately if obvious.
3. Fix any grammar and spelling issues.
4. Format using strict Markdown (headers with ##, bolding for titles, bullet points for lists).
5. Output ONLY the markdown text, no preamble or explanation.

Raw Text:
${text}`;

  try {
    const provider = getDefaultProvider();
    const result = await provider.generateContent(prompt);
    
    // Strip markdown fences
    let structuredText = result.text.trim();
    if (structuredText.startsWith('```')) {
      structuredText = structuredText.replace(/^```(?:markdown)?\n?/, '').replace(/\n?```$/, '').trim();
    }
    
    const resume = await Resume.create({
      userId,
      originalText: structuredText,
      jobRole: jobRole || null,
      title: `Resume from Text — ${new Date().toLocaleDateString()}`
    });

    try {
      await withResumeAssociation(resume._id, userId, 'version', () => ResumeVersion.create({
        resumeId: resume._id,
        userId,
        versionNumber: 1,
        title: 'v1 - Structured from Text',
        originalText: resume.originalText,
        enhancedText: null,
        jobRole: resume.jobRole,
        atsScore: null,
        tags: ['text-import'],
        metadata: { source: 'text-to-resume' }
      }));
    } catch (err) {
      await deleteResumeOwned(resume._id, userId);
      throw err;
    }

    res.status(201).json({
      success: true,
      data: {
        id: resume._id.toString(),
        userId: resume.userId,
        originalText: resume.originalText,
        enhancedText: resume.enhancedText,
        jobRole: resume.jobRole,
        title: resume.title,
        revision: resume.revision,
        contentRevision: resume.contentRevision,
        createdAt: resume.createdAt
      }
    });
  } catch (error) {
    logEvent('resume.structure_failed');
    throw new ApiError(500, 'Failed to structure resume from text');
  }
}));

// NOTE: this endpoint spends a hosted AI call, so it must stay behind
// authentication and the AI rate limiter like every other AI route.
router.post('/score', verifyToken, aiRateLimiter, asyncHandler(async (req, res) => {
  const { resumeText } = req.body;

  if (!resumeText || !resumeText.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Resume text is required'
    });
  }

  const analysisResult = await analyzeResume(resumeText);

  res.json({
    success: true,
    data: analysisResult
  });
}));


// Get all versions of a resume
router.get('/:resumeId/versions', verifyToken, asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  const userId = req.user.uid;

  const resume = await Resume.findOne({ _id: resumeId, userId });
  if (!resume) {
    throw new ApiError(404, 'Resume not found');
  }

  const versions = await ResumeVersion.find({ resumeId })
    .sort({ versionNumber: -1 })
    .lean();

  res.json({
    success: true,
    data: versions.map(v => ({
      id: v._id.toString(),
      ...v,
      _id: undefined
    }))
  });
}));

// Create a new snapshot/version of a resume
router.post('/:resumeId/versions', verifyToken, validate(createResumeVersionSchema), asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  const userId = req.user.uid;
  const { title, originalText, enhancedText, jobRole, atsScore, tags, metadata } = req.body;

  const newVersion = await withResumeAssociation(resumeId, userId, 'version', async () => {

  let retries = 3;
  let createdVersion;
  while (retries > 0) {
    // Find latest version number
    const latestVersion = await ResumeVersion.findOne({ resumeId })
      .sort({ versionNumber: -1 })
      .select('versionNumber')
      .lean();

    const nextVersionNum = latestVersion ? latestVersion.versionNumber + 1 : 1;
    const defaultTitle = title || `Version ${nextVersionNum} - ${new Date().toLocaleDateString()}`;

    try {
      createdVersion = await ResumeVersion.create({
        resumeId,
        userId,
        versionNumber: nextVersionNum,
        title: defaultTitle,
        originalText,
        enhancedText: enhancedText || null,
        jobRole: jobRole || null,
        atsScore: atsScore !== undefined && atsScore !== null ? atsScore : null,
        tags: tags || [],
        metadata: metadata || {}
      });
      break;
    } catch (err) {
      if (err.code === 11000 && retries > 1) {
        retries--;
        continue;
      }
      throw err;
    }
  }
  return createdVersion;
  });

  res.status(201).json({
    success: true,
    data: {
      id: newVersion._id.toString(),
      resumeId: newVersion.resumeId,
      userId: newVersion.userId,
      versionNumber: newVersion.versionNumber,
      title: newVersion.title,
      originalText: newVersion.originalText,
      enhancedText: newVersion.enhancedText,
      jobRole: newVersion.jobRole,
      atsScore: newVersion.atsScore,
      tags: newVersion.tags,
      metadata: newVersion.metadata,
      createdAt: newVersion.createdAt,
      updatedAt: newVersion.updatedAt
    }
  });
}));

// Update metadata of a specific version
router.put('/:resumeId/versions/:versionId', verifyToken, validate(updateResumeVersionSchema), asyncHandler(async (req, res) => {
  const { resumeId, versionId } = req.params;
  const userId = req.user.uid;
  const updates = req.body;

  const version = await withResumeAssociation(resumeId, userId, 'version', async () => {
  const version = await ResumeVersion.findOne({ _id: versionId, resumeId, userId });
  if (!version) {
    throw new ApiError(404, 'Resume version not found');
  }

  if (updates.title !== undefined) version.title = updates.title;
  if (updates.tags !== undefined) version.tags = updates.tags;
  if (updates.jobRole !== undefined) version.jobRole = updates.jobRole;

  await version.save();
  return version;
  });

  res.json({
    success: true,
    data: {
      id: version._id.toString(),
      resumeId: version.resumeId,
      userId: version.userId,
      versionNumber: version.versionNumber,
      title: version.title,
      originalText: version.originalText,
      enhancedText: version.enhancedText,
      jobRole: version.jobRole,
      atsScore: version.atsScore,
      tags: version.tags,
      metadata: version.metadata,
      createdAt: version.createdAt,
      updatedAt: version.updatedAt
    }
  });
}));

// Delete a specific version
router.delete('/:resumeId/versions/:versionId', verifyToken, asyncHandler(async (req, res) => {
  const { resumeId, versionId } = req.params;
  const userId = req.user.uid;

  await withResumeAssociation(resumeId, userId, 'version', async () => {
  // Enforce a server-side minimum of one version before deletion
  const totalVersions = await ResumeVersion.countDocuments({ resumeId });
  if (totalVersions <= 1) {
    throw new ApiError(400, 'Cannot delete the only remaining version of the resume');
  }

  const deletedVersion = await ResumeVersion.findOneAndDelete({ _id: versionId, resumeId, userId });
  if (!deletedVersion) {
    throw new ApiError(404, 'Resume version not found');
  }
  });

  res.json({
    success: true,
    message: 'Version deleted successfully'
  });
}));

// Restore resume to a specific version
router.post('/:resumeId/versions/:versionId/restore', verifyToken, validate(restoreResumeSchema), asyncHandler(async (req, res) => {
  const { resumeId, versionId } = req.params;
  const userId = req.user.uid;

  const version = await ResumeVersion.findOne({ _id: versionId, resumeId, userId }).lean();
  if (!version) {
    throw new ApiError(404, 'Resume version not found');
  }

  const updatedResume = await saveResumeBody(resumeId, userId, {
    revision: req.body.revision,
    originalText: version.originalText,
    enhancedText: version.enhancedText,
    jobRole: version.jobRole,
    atsScore: version.atsScore,
  });

  res.json({
    success: true,
    message: 'Resume restored successfully',
    data: {
      id: updatedResume._id.toString(),
      userId: updatedResume.userId,
      originalText: updatedResume.originalText,
      enhancedText: updatedResume.enhancedText,
      jobRole: updatedResume.jobRole,
      atsScore: updatedResume.atsScore,
      title: updatedResume.title,
      revision: updatedResume.revision,
      contentRevision: updatedResume.contentRevision,
      createdAt: updatedResume.createdAt,
      lastModified: updatedResume.lastModified
    }
  });
}));

// Get ATS score progression history for a resume
router.get('/:resumeId/ats-history', verifyToken, asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  const userId = req.user.uid;

  const history = await ResumeAtsHistory.find({ resumeId, userId })
    .sort({ createdAt: 1 })
    .lean();

  res.json({
    success: true,
    data: history.map(h => ({
      id: h._id.toString(),
      resumeId: h.resumeId,
      userId: h.userId,
      jobRole: h.jobRole,
      atsScore: h.atsScore,
      scoreBreakdown: h.scoreBreakdown,
      missingKeywords: h.missingKeywords,
      improvementsCount: h.improvementsCount,
      createdAt: h.createdAt
    }))
  });
}));

// Log a new ATS score analysis run
router.post('/:resumeId/ats-history', verifyToken, validate(createAtsHistorySchema), asyncHandler(async (req, res) => {
  const { resumeId } = req.params;
  const userId = req.user.uid;
  const { jobRole, atsScore, scoreBreakdown, missingKeywords, improvementsCount } = req.body;

  const newLog = await withResumeAssociation(resumeId, userId, 'ats', () => ResumeAtsHistory.create({
    resumeId,
    userId,
    jobRole,
    atsScore,
    scoreBreakdown: scoreBreakdown || {},
    missingKeywords: missingKeywords || [],
    improvementsCount: improvementsCount || 0
  }));

  res.status(201).json({
    success: true,
    data: {
      id: newLog._id.toString(),
      resumeId: newLog.resumeId,
      userId: newLog.userId,
      jobRole: newLog.jobRole,
      atsScore: newLog.atsScore,
      scoreBreakdown: newLog.scoreBreakdown,
      missingKeywords: newLog.missingKeywords,
      improvementsCount: newLog.improvementsCount,
      createdAt: newLog.createdAt
    }
  });
}));

export default router;

