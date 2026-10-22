export const SCORE_VERSION = 'available-v1';
const standardWeights = { relevance: .35, clarity: .25, confidence: .20, expression: .20 };
const codingWeights = { relevance: .25, clarity: .15, confidence: .15, expression: .15, codeQuality: .30 };
export const observedScore = (value) => Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;

export function normalizeAnalysisScores(analysis) {
  if (!analysis || typeof analysis !== 'object' || Array.isArray(analysis)) throw new Error('Invalid analysis result');
  const normalized = { ...analysis };
  for (const key of ['relevance', 'clarity', 'confidence']) {
    if (analysis[key] != null && observedScore(analysis[key]) === null) throw new Error('Invalid observed score');
    normalized[key] = analysis[key] ?? null;
  }
  if (analysis.codeAnalysis) {
    const score = analysis.codeAnalysis.codeQuality;
    if (score != null && observedScore(score) === null) throw new Error('Invalid code score');
    normalized.codeAnalysis = { ...analysis.codeAnalysis, codeQuality: score ?? null };
  }
  return normalized;
}

export function answerObservations(analysis, expressionMetrics) {
  return {
    relevance: observedScore(analysis?.relevance) !== null,
    clarity: observedScore(analysis?.clarity) !== null,
    confidence: observedScore(analysis?.confidence) !== null,
    expression: observedScore(expressionMetrics?.overallExpressionScore) !== null,
    codeQuality: observedScore(analysis?.codeAnalysis?.codeQuality) !== null,
  };
}

export function availableScores(interview) {
  const weights = interview.mode === 'coding' ? codingWeights : standardWeights;
  const dimensions = {};
  let weighted = 0, availableWeight = 0;
  for (const [name, weight] of Object.entries(weights)) {
    let sum = 0, observed = 0;
    for (const answer of interview.answers || []) {
      const value = observedScore(name === 'expression' ? answer.expressionMetrics?.overallExpressionScore
        : name === 'codeQuality' ? answer.analysis?.codeAnalysis?.codeQuality : answer.analysis?.[name]);
      if (value === null || answer.observations?.[name] === false) continue;
      sum += value;
      observed++;
    }
    const score = observed ? sum / observed : null;
    dimensions[name] = { score, observed, answered: interview.answers.length, weight, effectiveWeight: 0, status: observed ? 'available' : 'unavailable' };
    if (observed) { weighted += score * weight; availableWeight += weight; }
  }
  const basis = Object.keys(dimensions).filter((key) => dimensions[key].observed);
  for (const key of basis) dimensions[key].effectiveWeight = dimensions[key].weight / availableWeight;
  return {
    version: SCORE_VERSION, mode: interview.mode, basis, answeredCount: interview.answers.length, dimensions,
    overallScore: availableWeight ? Math.round(weighted / availableWeight) : null,
    comparisonKey: `${SCORE_VERSION}:${interview.mode}:${basis.join(',')}`,
  };
}

export function sessionJson(record) {
  const value = typeof record.toObject === 'function' ? record.toObject() : record;
  const generation = value.generation?.kind ? {
    kind: value.generation.kind, status: value.generation.status,
    leaseUntil: value.generation.leaseUntil, errorCode: value.generation.errorCode,
  } : null;
  return { ...value, interviewId: String(value._id), purpose: value.purpose || 'interview',
    scoreVersion: value.purpose === 'discovery' ? null : value.scoreVersion || 'legacy',
    scoring: value.purpose === 'discovery' ? null : value.scoring || null,
    overallScore: value.purpose === 'discovery' ? null : value.overallScore ?? null,
    generation };
}

export function groupedAnalytics(records) {
  const sessions = records.filter((row) => row.purpose !== 'discovery').map((row) => ({
    _id: row._id, date: row.completedAt?.toISOString?.().slice(0, 10) || null,
    overallScore: row.overallScore ?? null, scoreVersion: row.scoreVersion || 'legacy',
    mode: row.mode, scoring: row.scoring || null,
    purpose: 'interview',
    comparisonKey: row.scoring?.comparisonKey || `legacy:${row.mode}`,
    communication: row.scoring?.dimensions?.clarity?.score ?? null,
    technicalAccuracy: row.scoring?.dimensions?.relevance?.score ?? null,
    confidence: row.scoring?.dimensions?.confidence?.score ?? null,
  }));
  const groups = [];
  for (const key of new Set(sessions.map((row) => row.comparisonKey))) {
    const rows = sessions.filter((row) => row.comparisonKey === key);
    const scores = rows.map((row) => row.overallScore).filter(Number.isFinite);
    groups.push({ comparisonKey: key, count: rows.length, averageOverallScore: scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null });
  }
  return { sessions, groups, summary: { count: sessions.length, averageOverallScore: groups.length === 1 ? groups[0].averageOverallScore : null, latestSession: sessions.at(-1) || null } };
}
