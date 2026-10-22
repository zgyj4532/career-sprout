import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderImportedResume } from '../importSave.js'

const material = (extra = {}) => ({ name: '', email: '', phone: '', bio: '', education: [], experiences: [], skills: [], otherMaterials: '', ...extra })

test('original education and experience facts render once despite whitespace differences', () => {
  const education = { institution: '测试大学', degree: '本科', field: '软件工程', dateText: '2022.09—至今', fullText: '测试大学 本科\n软件工程 2022.09 — 至今' }
  const experience = { title: '校园项目', organization: '测试社团', dateText: '2025.01', fullText: '2025.01 校园项目\n测试 社团：参与需求整理。' }
  const rendered = renderImportedResume(material({ education: [education], experiences: [experience] }))
  assert.equal(rendered, `## 教育经历\n${education.fullText}\n\n## 经历\n${experience.fullText}`)
  assert.equal(rendered.split('测试大学').length - 1, 1)
  assert.equal(rendered.split('校园项目').length - 1, 1)
})

test('missing facts are prepended once and explicitly adopted brief retains missing context', () => {
  const experience = { title: '校园项目', organization: '测试社团', dateText: '2025.01', fullText: '校园项目：参与需求整理。', brief: '参与需求整理。' }
  assert.equal(renderImportedResume(material({ experiences: [experience] })), '## 经历\n测试社团\n2025.01\n校园项目：参与需求整理。')
  assert.equal(renderImportedResume(material({ experiences: [{ ...experience, useConcise: true }] })), '## 经历\n校园项目\n测试社团\n2025.01\n参与需求整理。')
  assert.equal(experience.fullText, '校园项目：参与需求整理。')
})

test('heading-only leftovers do not create an empty other-material section or alter stored source', () => {
  const input = material({ otherMaterials: '教育经历\n\n项目经历：\n\n## 技能' })
  assert.equal(renderImportedResume(input), '')
  assert.equal(input.otherMaterials, '教育经历\n\n项目经历：\n\n## 技能')
  input.otherMaterials = '教育经历\n\n证书\n校级奖项\n\n项目经历：参与校内调研'
  assert.equal(renderImportedResume(input), '## 其他原文材料\n证书\n校级奖项\n\n项目经历：参与校内调研')
})
