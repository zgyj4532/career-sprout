export function interviewScore(record) {
  if (record?.purpose === 'discovery') return null
  const value = record?.scoreVersion === 'available-v1' ? record.scoring?.overallScore : record?.overallScore
  return Number.isFinite(value) ? value : null
}

export function comparisonKey(record) {
  if (interviewScore(record) === null) return null
  if (record.scoreVersion === 'available-v1') return record.scoring?.comparisonKey || null
  return `legacy:${record.mode || 'behavioral'}`
}

const modeLabels = { mixed: 'Combined practice', technical: 'Technical practice', behavioral: 'Experience and communication', coding: 'Coding' }
const dimensionLabels = { relevance: 'Answer relevance', clarity: 'Clarity', confidence: 'Text confidence', expression: 'Observed expression', codeQuality: 'Code quality' }

export function scoreRule(record) {
  if (record?.purpose === 'discovery') return 'Discovery · unscored'
  const mode = modeLabels[record?.mode || record?.scoring?.mode] || 'Practice type not recorded'
  if (record?.scoreVersion !== 'available-v1') return `Legacy scoring · ${mode} · original score retained`
  return `Available dimensions · ${mode} · ${(record.scoring?.basis || []).map((key) => dimensionLabels[key] || 'Other observed dimension').join(', ') || 'none assessed'}`
}
