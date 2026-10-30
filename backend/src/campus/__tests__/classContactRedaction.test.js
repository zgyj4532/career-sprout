import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactClassMatch, redactClassText } from '../classes.js';

test('class and generation source text hides supported contact formats', () => {
  const cases = [
    ['邮箱 Test.Name+tag@example.org', '邮箱 [邮箱已隐藏]'],
    ['电话 13800138000', '电话 [电话已隐藏]'],
    ['+86 138 0013 8000 / 138-0013-8000 / 138.0013.8000', '[电话已隐藏] / [电话已隐藏] / [电话已隐藏]'],
    ['(86) 138 0013 8000', '[电话已隐藏]'],
    ['010-12345678 / (0755) 1234567转123', '[电话已隐藏] / [电话已隐藏]'],
    ['+86 021 12345678 ext. 12', '[电话已隐藏]'],
    ['微信：sample_id QQ号: 12345678 WeChat ID = sample-id', '[联系方式已隐藏] [联系方式已隐藏] [联系方式已隐藏]'],
    ['微信号 sample_id', '[联系方式已隐藏]'],
    ['微信：138 0013 8000', '微信：[电话已隐藏]'],
    ['ＡＢＣ＠ＥＸＡＭＰＬＥ．ＯＲＧ / １３８－００１３－８０００', '[邮箱已隐藏] / [电话已隐藏]'],
    ['fixture at example dot org / fixture[at]example[dot]org / fixture艾特example点org', '[邮箱已隐藏] / [邮箱已隐藏] / [邮箱已隐藏]'],
    ['fixture [at] example [dot] org / fixture (at) example (dot) org', '[邮箱已隐藏] / [邮箱已隐藏]'],
    ['一三八零零一三八零零零 / 幺三八 零零幺三 八零零零', '[电话已隐藏] / [电话已隐藏]'],
    ['one three eight zero zero one three eight zero zero zero', '[电话已隐藏]'],
    ['Telegram: @fixture WhatsApp＝sample-id Discord: fixture', '[联系方式已隐藏] [联系方式已隐藏] [联系方式已隐藏]'],
    ['https://example.org/contact?id=fixture / www.example.org/contact / mailto:fixture@example.org / tel:+8613800138000', '[链接已隐藏] / [链接已隐藏] / [联系方式已隐藏] / [联系方式已隐藏]'],
    ['weixin://contacts/fixture / tg://resolve?domain=fixture / skype:fixture', '[联系方式已隐藏] / [联系方式已隐藏] / [联系方式已隐藏]'],
  ];
  for (const [input, expected] of cases) assert.equal(redactClassText(input), expected);
});

test('ordinary facts and unlabelled account-like numbers remain unchanged', () => {
  const input = '项目使用微信开发工具，2023-09 至 2024-06，记录 12345678 条；技能 SQL。';
  assert.equal(redactClassText(input), input);
  assert.equal(redactClassText(null), '');
  assert.equal(redactClassText('全角ＡＢＣ，项目使用 Telegram API，电话号码是一三八个样本。'), '全角ＡＢＣ，项目使用 Telegram API，电话号码是一三八个样本。');
  assert.equal(redactClassText('全角ＡＢＣ；2023年完成 138 个项目；邮箱协议与微信开发工具。'), '全角ＡＢＣ；2023年完成 138 个项目；邮箱协议与微信开发工具。');
});

test('matching skill names and evidence use the same redaction rules', () => {
  const match = {
    matchedSkills: [{ name: '微信: sample_id', evidence: '邮箱 fixture@example.org' }],
    missingSkills: [{ name: 'SQL', evidence: '电话 138 0013 8000' }],
    unknownSkills: [{ name: 'QQ: 12345678', evidence: '(010) 12345678' }],
    coverage: 0.5,
  };
  assert.deepEqual(redactClassMatch(match), {
    matchedSkills: [{ name: '[联系方式已隐藏]', evidence: '邮箱 [邮箱已隐藏]' }],
    missingSkills: [{ name: 'SQL', evidence: '电话 [电话已隐藏]' }],
    unknownSkills: [{ name: '[联系方式已隐藏]', evidence: '[电话已隐藏]' }],
    coverage: 0.5,
  });
});
