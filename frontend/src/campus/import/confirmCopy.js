export function confirmView(result = {}) {
  if (!result) return { state: 'empty', summary: '' }
  if (result.status === 'restoring') return { state: 'saved', summary: result.phase || '恢复结果未知，可以继续恢复。原件仍保留。' }
  if (result.saved || result.status === 'saved') return { state: 'saved', summary: result.cachePending ? '资料已保存，缓存等待刷新。' : '档案和简历已保存。' }
  if (result.status === 'restored') return { state: 'saved', summary: result.cachePending ? '内容已恢复，缓存等待刷新；原件仍保留。' : '已恢复导入前的版本，原件仍保留。' }
  if (result.status === 'save_unknown' || result.status === 'saving') return { state: 'blocked', phase: result.status === 'saving' ? '正在保存，请稍后检查结果。' : '保存结果未知，继续处理会复用已完成的步骤。', action: '检查保存结果并继续', kept: result.kept !== false }
  if (result.phase === 'busy' || result.phase === 'failed' || result.busy || result.failed) {
    return {
      state: 'blocked',
      phase: result.phase || (result.busy ? '文件已收好' : '读取没有完成'),
      kept: result.kept !== false,
      action: result.kept === false ? '更换文件' : '继续处理',
    }
  }
  const decisions = result.decisions || result.issues?.length || 0
  const summary = result.summary || `将补充 ${result.experiences || 0} 段经历、${result.skills || 0} 个技能，有 ${decisions} 处需要你决定。`
  if (decisions > 0) {
    return { state: 'issues', summary, action: '处理这几处', alternate: '先保存其余内容', save: saveCopy(result) }
  }
  return { state: 'clear', summary, action: '保存并继续', save: saveCopy(result) }
}

export function saveCopy(result = {}) {
  const resume = result.resumeTitle || '这份简历'
  return `补充我的档案，并${result.resumeId ? '更新' : '新建'}《${resume}》`
}

export function gapLabel(kind) {
  if (kind === 'read_failed') return '读取失败'
  if (kind === 'suspected_miss') return '疑似漏读'
  return kind === 'absent' ? '原文没写' : '需要核对'
}
