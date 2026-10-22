import { comparisonKey } from './interviewScores'

export const analyzePerformance = (records = []) => {
  const sessions = records.filter((row) => row.purpose !== 'discovery')
  const groups = new Set(sessions.map(comparisonKey).filter(Boolean))
  const result = { weaknesses: [], recurringWeaknesses: [], strengths: [], recommendations: [], improvement: null, averages: { communication: null, technical: null, confidence: null } }
  if (!sessions.length || groups.size !== 1) return result
  const dimensions = [
    ['communication', 'communication', 'Communication', 'Practice structuring your answers clearly.'],
    ['technicalAccuracy', 'technical', 'Technical Accuracy', 'Review the technical points identified in your answers.'],
    ['confidence', 'confidence', 'Text confidence', 'Try making your wording more specific.']
  ]
  for (const [field, key, label, recommendation] of dimensions) {
    const values = sessions.map((row) => row[field]).filter(Number.isFinite)
    if (!values.length) continue
    const average = values.reduce((sum, value) => sum + value, 0) / values.length
    result.averages[key] = Number(average.toFixed(1))
    if (average < 70) { result.weaknesses.push(label); result.recommendations.push(recommendation) }
    else if (average >= 80) result.strengths.push(label)
    if (values.filter((value) => value < 70).length > 1) result.recurringWeaknesses.push(label)
  }
  const first = sessions[0]?.overallScore
  const last = sessions[sessions.length - 1]?.overallScore
  if (sessions.length > 1 && Number.isFinite(first) && Number.isFinite(last)) result.improvement = Number((last - first).toFixed(1))
  return result
}
