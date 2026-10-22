import express from 'express';
import { ApiError } from '../middleware/errorHandler.js';
import { accountWriteHandler as asyncHandler } from '../campus/accountWrites.js';
import { verifyToken } from '../middleware/auth.js';
import {
  cacheProfileResponse,
  invalidateProfileCache,
} from '../services/profileCache.js';
import UserProfile from '../models/UserProfile.model.js';
import Resume from '../models/Resume.model.js';
import Interview from '../models/Interview.model.js';

import { validate } from '../middleware/validate.js';
import { updateProfileSchema, setAvatarSchema } from '../schemas/userProfile.schema.js';
import { preserveEducation } from '../campus/importSave.js';
import { writeProfileFields, profileJson, publicProfileJson } from '../campus/profileWrite.js';

const router = express.Router();

router.use(verifyToken);

const getPostsForUser = async (uid) => {
  return [];
};

// Get or create own profile
router.get('/me', cacheProfileResponse, asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  let profile = await UserProfile.findOne({ uid }).select('+phone +dateOfBirth +gender');
  if (!profile) {
    profile = await UserProfile.create({
      uid,
      displayName: req.user.name || req.user.email?.split('@')[0] || '',
    });
    profile = profile.toObject();
  }
  res.json({ success: true, profile: profileJson(profile) });
}));

// Update own profile
router.put('/me', validate(updateProfileSchema), asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const {
    displayName, bio, jobRole, skills, location, website, github, linkedin,
    avatarUrl, phone, headline, dateOfBirth, gender, company, yearsOfExperience,
    collegeStudent, studyStage, openToWork, education, languages, resumeHeadline,
  } = req.body;

  const update = {};
  // --- Existing fields ---
  if (displayName !== undefined) update.displayName = String(displayName).slice(0, 100);
  if (bio !== undefined) update.bio = String(bio).slice(0, 500);
  if (jobRole !== undefined) update.jobRole = String(jobRole).slice(0, 100);
  if (skills !== undefined) {
    update.skills = Array.isArray(skills)
      ? skills.map(s => String(s).trim()).filter(Boolean)
      : [];
  }
  if (location !== undefined) update.location = String(location).slice(0, 100);
  if (website !== undefined) update.website = String(website).slice(0, 200);
  if (github !== undefined) update.github = String(github).slice(0, 100);
  if (linkedin !== undefined) update.linkedin = String(linkedin).slice(0, 200);

  // --- New personal-info fields ---
  if (avatarUrl !== undefined) update.avatarUrl = String(avatarUrl).slice(0, 500);
  if (phone !== undefined) update.phone = String(phone).slice(0, 30);
  if (headline !== undefined) update.headline = String(headline).slice(0, 120);
  if (dateOfBirth !== undefined) update.dateOfBirth = dateOfBirth;
  if (gender !== undefined) update.gender = gender;
  if (company !== undefined) update.company = String(company).slice(0, 100);
  if (yearsOfExperience !== undefined) update.yearsOfExperience = yearsOfExperience;
  if (collegeStudent !== undefined) { update.collegeStudent = collegeStudent; update.collegeStudentKnown = collegeStudent !== null; }
  if (studyStage !== undefined) {
    update.studyStage = studyStage;
    if (studyStage && collegeStudent === undefined) { update.collegeStudent = studyStage !== '已毕业'; update.collegeStudentKnown = true; }
  }
  if (openToWork !== undefined) update.openToWork = Boolean(openToWork);
  if (resumeHeadline !== undefined) update.resumeHeadline = String(resumeHeadline).slice(0, 300);

  if (education !== undefined) {
    update.education = preserveEducation(education);
  }
  if (req.body.otherMaterials !== undefined) update.otherMaterials = String(req.body.otherMaterials).slice(0, 20000);

  if (languages !== undefined) {
    update.languages = Array.isArray(languages)
      ? languages.slice(0, 20).map(l => String(l).trim()).filter(Boolean)
      : [];
  }

  const profile = await writeProfileFields(UserProfile, uid, update, req.body.expectedUpdatedAt);

  let cachePending = false;
  try {
    await invalidateProfileCache(uid);
  } catch {
    cachePending = true;
  }
  res.json({ success: true, saved: true, cachePending, profile: profileJson(profile) });
}));

router.post('/me/cache', asyncHandler(async (req, res) => {
  await invalidateProfileCache(req.user.uid);
  res.json({ success: true, saved: true, cachePending: false });
}));

// Set avatar URL (client uploads to Firebase Storage, then persists the URL here)
router.post('/me/avatar', validate(setAvatarSchema), asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const { avatarUrl } = req.body;

  const profile = await UserProfile.findOneAndUpdate(
    { uid },
    { $set: { avatarUrl } },
    { new: true, upsert: true }
  ).select('+phone +dateOfBirth +gender');

  await invalidateProfileCache(uid);
  res.json({ success: true, profile });
}));

// Remove avatar
router.delete('/me/avatar', asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const profile = await UserProfile.findOneAndUpdate(
    { uid },
    { $set: { avatarUrl: '' } },
    { new: true, upsert: true }
  ).select('+phone +dateOfBirth +gender');

  await invalidateProfileCache(uid);
  res.json({ success: true, profile });
}));

// Get own stats
router.get('/me/stats', asyncHandler(async (req, res) => {
  const uid = req.user.uid;
  const [resumesCreated, interviewsDone] = await Promise.all([
    Resume.countDocuments({ userId: uid }),
    Interview.countDocuments({ userId: uid, status: 'completed', purpose: { $ne: 'discovery' } }),
  ]);
  res.json({ success: true, stats: { resumesCreated, interviewsDone } });
}));

// Get own activity feed (community posts)
router.get('/me/activity', asyncHandler(async (req, res) => {
  const activity = await getPostsForUser(req.user.uid);
  res.json({ success: true, activity });
}));

// Get public profile by uid
router.get('/:uid', cacheProfileResponse, asyncHandler(async (req, res) => {
  if (req.campusRequest && req.params.uid !== req.user.uid) throw new ApiError(403, 'Access denied.');
  const profile = await UserProfile.findOne({ uid: req.params.uid });
  if (!profile) throw new ApiError(404, 'Profile not found');
  res.json({ success: true, profile: req.params.uid === req.user.uid ? profileJson(profile) : publicProfileJson(profile) });
}));

// Get public stats by uid
router.get('/:uid/stats', asyncHandler(async (req, res) => {
  const uid = req.params.uid;
  if (uid !== req.user.uid) {
    throw new ApiError(403, 'Access denied. You can only view your own stats.');
  }
  const [resumesCreated, interviewsDone] = await Promise.all([
    Resume.countDocuments({ userId: uid }),
    Interview.countDocuments({ userId: uid, status: 'completed', purpose: { $ne: 'discovery' } }),
  ]);
  res.json({ success: true, stats: { resumesCreated, interviewsDone } });
}));

// Get public activity feed by uid
router.get('/:uid/activity', asyncHandler(async (req, res) => {
  const activity = await getPostsForUser(req.params.uid);
  res.json({ success: true, activity });
}));

export default router;
