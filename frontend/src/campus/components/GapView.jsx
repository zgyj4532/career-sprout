import { SKILL_LEVELS, TIME_LABELS } from '../material'

export default function GapView({ gap }) {
  if (!gap) return null
  return <section className="campus-panel"><h2>与岗位的距离</h2><p>{TIME_LABELS[gap.timeStatus] || '时间待确认'} · 依据自评与岗位要求，不是能力考试。</p>
    <div className="campus-grid">{[['matchedSkills', '已达到自评等级'], ['missingSkills', '可以继续练习'], ['unknownSkills', '还没有自评']].map(([key, title]) => <div className="campus-card" key={key}><h3>{title}</h3>{!gap[key]?.length && <p>暂无此类技能</p>}<ul>{(gap[key] || []).map((skill) => <li key={skill.name}><strong>{skill.name}</strong><p>要求：{SKILL_LEVELS[skill.requiredLevel] ?? '待确认'}；目前：{skill.currentLevel == null ? '未知' : SKILL_LEVELS[skill.currentLevel]}</p><p>{skill.evidence || '证据待补充：记录一次真实使用这项技能的经历。'}</p></li>)}</ul></div>)}</div>
    {!!gap.nextSteps?.length && <><h3>下一步</h3><ul>{gap.nextSteps.map((step, index) => <li key={index}>{typeof step === 'string' ? step : step.text || step.description || step.name}</li>)}</ul></>}
  </section>
}
