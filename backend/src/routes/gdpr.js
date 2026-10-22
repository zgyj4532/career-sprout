import express from 'express';
import { verifyToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

import UserProfile from '../models/UserProfile.model.js';
import Resume from '../models/Resume.model.js';
import Portfolio from '../models/Portfolio.model.js';
import {
  invalidateProfileCache,
} from '../services/profileCache.js';
import TrackedJob from '../models/TrackedJob.model.js';
import Interview from '../models/Interview.model.js';

import JobAlert from '../models/JobAlert.model.js';
import NotificationLog from '../models/NotificationLog.model.js';
import ProjectAnalysis from '../models/ProjectAnalysis.model.js';
import RepoAnalysisHistory from '../models/RepoAnalysisHistory.model.js';
import ResumeAtsHistory from '../models/ResumeAtsHistory.model.js';
import ResumeVersion from '../models/ResumeVersion.model.js';
import TokenUsage from '../models/TokenUsage.model.js';
import TwoFactor from '../models/TwoFactor.model.js';
import { CampusDiscoveryConfirmation, CampusSaveOperation, CampusStudent, CampusJob, CampusInterviewPrep } from '../campus/models.js';
import { withAccountErasure } from '../campus/accountWrites.js';
import { deleteResumeOwned } from '../campus/resumeDelete.js';

const router = express.Router();

router.use(verifyToken);

/**
 * @route GET /api/gdpr/export
 * @desc Export all user data
 * @access Private
 */
router.get(
  '/export',
  asyncHandler(async (req, res) => {
    const uid = req.user.uid;

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'User UID not found'
      });
    }

    const [
      profile,
      resumes,
      portfolios,
      trackedJobs,
      interviews,
      jobAlerts,
      notificationLogs,
      projectAnalyses,
      repoAnalysisHistory,
      resumeAtsHistory,
      resumeVersions,
      tokenUsage,
      twoFactor, discoveryConfirmations, materialSaveOperations, student, campusJobs, interviewPreparation
    ] = await Promise.all([
      UserProfile.findOne({ uid }).select('+phone +dateOfBirth +gender').lean(),
      Resume.find({ userId: uid }).lean(),
      Portfolio.find({ userId: uid }).lean(),
      TrackedJob.find({ userId: uid }).lean(),
      Interview.find({ userId: uid }).lean(),
      JobAlert.find({ userId: uid }).lean(),
      NotificationLog.find({ userId: uid }).lean(),
      ProjectAnalysis.find({ userId: uid }).lean(),
      RepoAnalysisHistory.find({ userId: uid }).lean(),
      ResumeAtsHistory.find({ userId: uid }).lean(),
      ResumeVersion.find({ userId: uid }).lean(),
      TokenUsage.find({ userId: uid }).lean(),
      TwoFactor.findOne({ uid }).lean(),
      CampusDiscoveryConfirmation.find({ userId: uid }).lean(),
      CampusSaveOperation.find({ userId: uid }).lean(),
      CampusStudent.findOne({ uid }).lean(),
      CampusJob.find({ creatorUid: uid }).lean(),
      CampusInterviewPrep.findOne({ uid }).lean()
    ]);

    res.status(200).json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),

        profile,
        resumes,
        portfolios,
        trackedJobs,
        interviews,

        jobAlerts,
        notificationLogs,

        projectAnalyses,
        repoAnalysisHistory,

        resumeAtsHistory,
        resumeVersions,

        tokenUsage,
        twoFactor, discoveryConfirmations, materialSaveOperations, student, campusJobs, interviewPreparation
      }
    });
  })
);

/**
 * @route DELETE /api/gdpr/delete
 * @desc Delete all user data (Right to Erasure)
 * @access Private
 */
export function eraseAccountData(uid) {
  return withAccountErasure(uid, async () => {
    const resumes = await Resume.find({ userId: uid }).select('_id').lean();
    for (const resume of resumes) await deleteResumeOwned(resume._id, uid);
    // Old operation IDs remain cancelled without retaining text/snapshots.
    // New authenticated requests may re-onboard after this erasure completes.
    const saveOperations = await CampusSaveOperation.updateMany({ userId: uid }, {
      $set: { status: 'cancelled' }, $unset: { frozen: '', result: '', leaseToken: '', leaseUntil: '' },
    });
    const collections = [
      ['profile', UserProfile, { uid }], ['portfolios', Portfolio, { userId: uid }],
      ['trackedJobs', TrackedJob, { userId: uid }], ['interviews', Interview, { userId: uid }],
      ['jobAlerts', JobAlert, { userId: uid }], ['notificationLogs', NotificationLog, { userId: uid }],
      ['projectAnalyses', ProjectAnalysis, { userId: uid }], ['repoAnalysisHistory', RepoAnalysisHistory, { userId: uid }],
      ['resumeAtsHistory', ResumeAtsHistory, { userId: uid }], ['resumeVersions', ResumeVersion, { userId: uid }],
      ['tokenUsage', TokenUsage, { userId: uid }], ['twoFactor', TwoFactor, { uid }],
      ['discoveryConfirmations', CampusDiscoveryConfirmation, { userId: uid }],
      ['student', CampusStudent, { uid }], ['campusJobs', CampusJob, { creatorUid: uid }],
      ['interviewPreparation', CampusInterviewPrep, { uid }],
    ];
    const deleted = { resumes: resumes.length, materialSaveOperations: saveOperations.modifiedCount };
    for (const [name, model, filter] of collections) deleted[name] = (await model.deleteMany(filter)).deletedCount;
    await invalidateProfileCache(uid);
    return deleted;
  });
}

router.delete('/delete', asyncHandler(async (req, res) => {
  const deleted = await eraseAccountData(req.user.uid);
  res.status(200).json({ success: true, message: 'All user data deleted successfully', deleted });
}));

export default router;