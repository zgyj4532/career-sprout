import { comparisonKey, interviewScore } from './interviewScores'

export const DEFAULT_PROGRESS = {
  level: "Beginner",
  streak: 0,
  failCount: 0,
  completedInterviews: 0,
  totalScore: 0,
  averageScore: 0
};

export function normalizeProgress(progress) {
  if (progress?.version === 2) return progress
  return { version: 2, legacy: progress || null, groups: {} }
}

export function progressFor(record, progress) {
  const key = comparisonKey(record)
  return (key && normalizeProgress(progress).groups[key]) || DEFAULT_PROGRESS
}

export const updateDifficulty = (record, progress) => {
  const ledger = normalizeProgress(progress)
  const key = comparisonKey(record)
  const score = interviewScore(record)
  if (!key || score === null) return ledger
  const updated = { ...progressFor(record, ledger) };

  updated.completedInterviews += 1;

  updated.totalScore += score;

  updated.averageScore =
    Math.round(
      updated.totalScore /
      updated.completedInterviews
    );

  if(score >= 80){
    updated.streak += 1;
    updated.failCount = 0;
  }

  if(score < 50){
    updated.failCount += 1;
    updated.streak = 0;
  }

  if(
    updated.level === "Beginner" &&
    updated.streak >= 3
  ){
    updated.level = "Intermediate";
    updated.streak = 0;
  }

  else if(
    updated.level === "Intermediate" &&
    updated.streak >= 3
  ){
    updated.level = "Advanced";
    updated.streak = 0;
  }

  if(updated.failCount >= 2){

    if(updated.level === "Advanced"){
      updated.level =
        "Intermediate";
    }

    else if(
      updated.level ===
      "Intermediate"
    ){
      updated.level =
        "Beginner";
    }

    updated.failCount = 0;
  }

  return { ...ledger, groups: { ...ledger.groups, [key]: updated } };
};