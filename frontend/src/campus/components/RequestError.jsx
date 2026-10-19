import { useState } from 'react'
import { downloadDiagnostics, errorText } from '../api'
import { safeValidationDetails, validationCorrection } from '../validation'

export default function RequestError({ error, onRetry }) {
  const [copied, setCopied] = useState(false)
  if (!error) return null
  const details = JSON.stringify({ requestId: error.requestId, code: error.code, status: error.status, method: error.method, route: error.path }, null, 2)
  return <div className="campus-error" role="alert">
    <p>{errorText(error)}</p>
    {error.code === 'VALIDATION_FAILED' && <ul>{safeValidationDetails(error.details).map((detail, index) => <li key={`${detail.field}:${index}`}>{validationCorrection(detail)}</li>)}</ul>}
    {onRetry && <button type="button" onClick={onRetry}>重试</button>}
    <details><summary>技术信息（不含个人材料）</summary>
      <pre>{details}</pre>
      <div className="campus-actions">
        <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(details); setCopied(true) } catch { setCopied(false) } }}>{copied ? '已复制' : '复制故障信息'}</button>
        <button type="button" onClick={downloadDiagnostics}>下载本次诊断</button>
      </div>
    </details>
  </div>
}
