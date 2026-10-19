import { afterEach, describe, expect, it, vi } from 'vitest'
import { campusFetch, downloadDiagnostics, logClientEvent } from '../api'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
describe('campus HTTP boundary', () => {
  it.each([
    ['ASR_SILENCE', 422, /语音|麦克风/],
    ['ASR_EMPTY_AUDIO', 422, /录音为空/],
    ['ASR_EMPTY', 502, /未识别到文字/],
    ['ASR_TOO_LONG', 422, /缩短/],
    ['ASR_TOO_LARGE', 413, /过大/],
    ['ASR_INVALID_AUDIO', 422, /格式无效/],
    ['ASR_BUSY', 429, /稍后重试转写/],
    ['PDF_BUSY', 429, /PDF/],
    ['RESUME_TOO_LONG', 422, /精简/],
    ['EXPORT_BUSY', 429, /批量导出/],
  ])('uses safe recovery for %s without exposing provider text', async (code, status, message) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status, headers: new Headers({ 'content-type': 'application/json' }), json: async () => ({ code, message: 'PRIVATE_PROVIDER_TEXT' }) }))
    const error = await campusFetch(code.startsWith('ASR_') ? '/api/interview/transcribe' : '/api/resumes/test/download').catch((failure) => failure)
    expect(error.code).toBe(code)
    expect(error.message).toMatch(message)
    expect(error.message).not.toContain('PRIVATE_PROVIDER_TEXT')
    if (code.startsWith('ASR_')) expect(error.message).not.toContain('导出')
  })
  it('does not treat an unknown interview422 as a PDF error or expose upstream text', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 422, headers: new Headers(), json: async () => ({ code: 'UNKNOWN_PROVIDER', message: 'PRIVATE_PROVIDER_TEXT' }) }))
    const error = await campusFetch('/api/interview/transcribe').catch((failure) => failure)
    expect(error.message).not.toMatch(/导出|PRIVATE_PROVIDER_TEXT/)
  })
  it('rejects malformed successful JSON with a correlation id', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json', 'X-Request-ID': 'server-test' }), json: async () => { throw new SyntaxError() } }))
    await expect(campusFetch('/api/campus/me')).rejects.toMatchObject({ code: 'INVALID_RESPONSE', requestId: 'server-test' })
    expect(fetch.mock.calls[0][1].headers.get('X-Request-ID')).toBeTruthy()
  })
  it('returns a real ZIP blob without attempting JSON', async () => {
    const blob = new Blob(['PK'], { type: 'application/zip' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, headers: new Headers({ 'content-type': 'application/zip' }), blob: async () => blob }))
    expect(await campusFetch('/api/campus/teacher/jobs/abc/export')).toBe(blob)
  })
  it('bounds exported diagnostics and removes payloads, queries and UIDs', async () => {
    let exported
    vi.stubGlobal('URL', { createObjectURL: vi.fn((blob) => { exported = blob; return 'blob:test' }), revokeObjectURL: vi.fn() })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    for (let index = 0; index < 250; index += 1) logClientEvent('request.completed', { route: '/api/campus/me/sharing/user_sensitive?email=private', transcript: 'secret-source', email: 'private', status: 200 })
    downloadDiagnostics()
    const text = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(exported) })
    const payload = JSON.parse(text)
    expect(payload.events).toHaveLength(200)
    expect(text).not.toContain('user_sensitive')
    expect(text).not.toContain('secret-source')
    expect(text).not.toContain('private')
    expect(payload.events[0].route).toBe('/api/campus/me/sharing/:id')
  })
})
