import { normalizeSkill } from './schemas.js';

export function timeCoverage(available = {}, required = {}) {
  let unknown = false;
  for (const key of ['startDate', 'endDate', 'daysPerWeek']) {
    if (required[key] == null) continue;
    if (available[key] == null) { unknown = true; continue; }
    if (key === 'startDate' ? available[key] > required[key] : available[key] < required[key]) return 'conflict';
  }
  // A job without any confirmed schedule is not a confirmed time match.
  if (!required.startDate && !required.endDate && required.daysPerWeek == null) return 'unknown';
  return unknown ? 'unknown' : 'covered';
}

export function matchStudent(student = {}, job = {}) {
  const skills = new Map((student.skillAssessments || []).map((skill) => [normalizeSkill(skill.name), skill]));
  const matchedSkills = [], missingSkills = [], unknownSkills = [];
  let requiredCount = 0, covered = 0;
  for (const requirement of job.requirements || []) {
    const assessment = skills.get(normalizeSkill(requirement.name));
    const entry = { name: requirement.name, requiredLevel: requirement.level, currentLevel: assessment?.level ?? null, evidence: assessment?.evidence || '' };
    if (requirement.required) requiredCount++;
    if (!assessment) unknownSkills.push(entry);
    else if (assessment.level < requirement.level) missingSkills.push(entry);
    else { matchedSkills.push(entry); if (requirement.required) covered++; }
  }
  const timeStatus = timeCoverage(student.availability, job.availability);
  const nextSteps = [];
  if (unknownSkills.length) nextSteps.push('为尚未自评的技能补充熟悉程度。');
  if (missingSkills.length) nextSteps.push('选择一项待提升技能，通过课程或小项目积累经验。');
  if (matchedSkills.some((skill) => !skill.evidence)) nextSteps.push('为已达到要求的技能补充真实经历证据。');
  if (timeStatus === 'unknown') nextSteps.push('补充并确认双方的实习时间要求。');
  if (timeStatus === 'conflict') nextSteps.push('当前时间不能完整覆盖岗位要求，请先协调时间。');
  return { matchedSkills, missingSkills, unknownSkills, timeStatus, nextSteps, coverage: requiredCount ? covered / requiredCount : null };
}
