import { expect, it } from 'vitest'
import { materialText } from '../material'

it('keeps original education text once and adds only facts missing from it', () => {
  const fullText = '测试大学 本科\n软件工程 2020年09月—至今'
  const material = { profile: { education: [{ institution: '测试大学', degree: '本科', field: '软件工程', dateText: '2020年09月—至今', current: true, fullText }] } }
  expect(materialText(material)).toBe(fullText)
  expect(material.profile.education[0].fullText).toBe(fullText)
  material.profile.education[0].fullText = '测试大学 本科'
  expect(materialText(material)).toBe('软件工程\n2020年09月—至今\n测试大学 本科')
})

it('renders adopted concise experience without duplicating its metadata or losing the stored original', () => {
  const experience = { title: '校园项目', organization: '学生社团', dateText: '2024年09月—至今', current: true, fullText: '校园项目 学生社团 2024年09月—至今\n参与调研，保留完整细节。', brief: '校园项目：参与调研。', useConcise: true }
  const original = experience.fullText
  const material = { student: { experiences: [experience] } }
  expect(materialText(material)).toBe('学生社团\n2024年09月—至今\n校园项目：参与调研。')
  expect(experience.fullText).toBe(original)
  experience.useConcise = false
  expect(materialText(material)).toBe(original)
})

it('filters only standalone leftover headings and keeps substantive lines and source unchanged', () => {
  const original = '教育经历\n## 专业技能：\n证书：普通话二级甲等\n项目经历：参与社区调研\n联系方式：student@example.invalid'
  const material = { profile: { otherMaterials: original }, student: { otherMaterials: original } }
  expect(materialText(material)).toBe('证书：普通话二级甲等\n项目经历：参与社区调研\n联系方式：student@example.invalid')
  expect(material.profile.otherMaterials).toBe(original)
  expect(material.student.otherMaterials).toBe(original)
})

it('preserves hand-written experience fields when no imported full text exists', () => {
  expect(materialText({ student: { experiences: [{ title: '课堂作业', context: '调研需求', actions: '访谈同学', result: '完成报告' }] } })).toBe('课堂作业\n调研需求\n访谈同学\n完成报告')
})

it('keeps plans out of resume evidence but retains labelled ideas for conversation practice', () => {
  const idea = { title: '未来计划', state: 'idea', fullText: '我想尝试做一个校园工具', sourceConversationId: 'conversation' }
  const ongoing = { title: '正在调研', state: 'in_progress', actions: '正在访谈同学' }
  const material = { student: { experiences: [idea, ongoing] } }
  expect(materialText(material)).not.toContain(idea.fullText)
  expect(materialText(material)).toContain('正在进行，尚未完成')
  expect(materialText(material, { includeIdeas: true })).toContain(idea.fullText)
  expect(materialText(material, { includeIdeas: true })).toContain('不是已完成经历或技能证据')
  expect(idea.state).toBe('idea')
  expect(idea.sourceConversationId).toBe('conversation')
})
