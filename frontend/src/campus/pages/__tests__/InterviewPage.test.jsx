import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { afterEach, expect, it, vi } from 'vitest'
import InterviewPage from '../InterviewPage'
import { campusData, campusFetch } from '../../api'
import { emptyPrep, saveInterviewPrep } from '../../import/interviewPrep'
vi.mock('../../auth', () => ({ useCampusSession: () => ({ status: { user: { uid: 'student' } } }) }))
vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), resumeRows: (payload) => payload.data, downloadDiagnostics: vi.fn(), errorText: (error) => error?.message }))
vi.mock('../../components/JobSelect', () => ({ default: ({ jobs, value, onChange }) => <label>测试岗位选择<select value={value} onChange={(event) => onChange(event.target.value)}><option value="">手填方向</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.title}</option>)}</select></label> }))
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals() })
it('restores the preparation after refresh and uses the saved job title', async () => {
  const jobId = '123456789012345678901234'
  saveInterviewPrep('student', { ...emptyPrep(), manualRole: '原来手填方向', jobRole: '旧岗位', jobId, text: '真实项目经历', count: 6, mode: 'technical' })
  campusData.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') return JSON.parse(options.body)
    if (path === '/me') return { profile: {}, student: {} }
    if (path === '/me/interview-prep') return null
    if (path === '/jobs?limit=50') return { items: [{ id: jobId, title: '刚保存的岗位名' }], total: 1 }
    throw new Error(path)
  })
  campusFetch.mockImplementation(async (path) => path.startsWith('/api/resumes?') ? { data: [] } : { data: { interviewId: 'session' } })
  render(<MemoryRouter initialEntries={['/interview']}><Routes>
    <Route path="/interview" element={<InterviewPage />} />
    <Route path="/interview/session/session" element={<h1>开始练习</h1>} />
  </Routes></MemoryRouter>)
  await screen.findByText(/这次使用已保存岗位：刚保存的岗位名/)
  screen.getByText('练习设置：专业与技术 · 6题').parentElement.open = true
  expect(screen.getByLabelText('题数')).toHaveValue('6')
  expect(screen.getByLabelText('练习类型')).toHaveValue('technical')
  expect(screen.getByLabelText('这次带入的真实经历')).toHaveValue('真实项目经历')
  expect(screen.getByText(/原来手填的方向：原来手填方向/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: '开始中文面试' }))
  expect(await screen.findByRole('heading', { name: '开始练习' })).toBeInTheDocument()
  const starts = campusFetch.mock.calls.filter(([path]) => path === '/api/interview/start')
  expect(starts).toHaveLength(1)
  const body = JSON.parse(starts[0][1].body)
  expect(body).toMatchObject({ jobRole: '刚保存的岗位名', jobId, questionCount: 6, mode: 'technical', resumeText: '真实项目经历' })
})

function JobRoute() { const location = useLocation(); return <p>岗位入口：{location.pathname}{location.search}</p> }
it('clears a deleted resume and opens screenshot entry with preparation retained', async () => {
  saveInterviewPrep('student', { ...emptyPrep(), resumeId: 'deleted', text: '保留的经历', manualRole: '手填方向', jobRole: '手填方向', count: 6 })
  campusData.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') return JSON.parse(options.body)
    if (path === '/me') return { profile: {}, student: {} }
    if (path === '/me/interview-prep') return null
    return { items: [], total: 0 }
  })
  campusFetch.mockResolvedValue({ data: [] })
  render(<MemoryRouter initialEntries={['/interview']}><Routes><Route path="/interview" element={<InterviewPage />} /><Route path="/jd" element={<JobRoute />} /></Routes></MemoryRouter>)
  expect(await screen.findByText(/原来选择的简历已不可用/)).toBeInTheDocument()
  expect(screen.getByLabelText('使用哪份已保存简历')).toHaveValue('')
  expect(screen.getByLabelText('这次带入的真实经历')).toHaveValue('保留的经历')
  fireEvent.click(screen.getByRole('button', { name: '上传岗位截图，保留这张准备单' }))
  expect(await screen.findByText('岗位入口：/jd?from=interview&entry=screenshot')).toBeInTheDocument()
  const saved = campusData.mock.calls.find(([, options]) => options?.method === 'PUT')
  expect(JSON.parse(saved[1].body)).toMatchObject({ resumeId: null, text: '保留的经历', count: 6 })
})

function prepareSources(resumes) {
  campusData.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') return JSON.parse(options.body)
    if (path === '/me') return { profile: {}, student: {} }
    if (path === '/me/interview-prep') return null
    return { items: [], total: 0 }
  })
  campusFetch.mockResolvedValue({ data: resumes })
}

it('saves edited practice settings and opens history without starting an interview', async () => {
  prepareSources([])
  render(<MemoryRouter initialEntries={['/interview']}><Routes>
    <Route path="/interview" element={<InterviewPage />} />
    <Route path="/history" element={<h1>练习历史</h1>} />
  </Routes></MemoryRouter>)
  const role = screen.getByLabelText('岗位或探索方向')
  await waitFor(() => expect(role).toBeEnabled())
  expect(screen.getByRole('button', { name: '开始中文面试' })).toBeDisabled()
  fireEvent.change(role, { target: { value: '开发工程师' } })
  // jsdom does not implement the native summary activation.
  screen.getByText('练习设置：综合练习 · 4题').parentElement.open = true
  fireEvent.change(screen.getByLabelText('练习类型'), { target: { value: 'behavioral' } })
  fireEvent.change(screen.getByLabelText('题数'), { target: { value: '8' } })
  expect(screen.getByText('练习设置：经历与表达 · 8题')).toBeVisible()
  expect(screen.getByRole('button', { name: '开始中文面试' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '保存准备单' }))
  await screen.findByText('准备单已保存，可以离开后继续。')
  const [, save] = campusData.mock.calls.find(([, options]) => options?.method === 'PUT')
  expect(JSON.parse(save.body)).toMatchObject({ jobRole: '开发工程师', mode: 'behavioral', count: 8 })
  fireEvent.click(screen.getByRole('link', { name: '查看以前的练习' }))
  expect(await screen.findByRole('heading', { name: '练习历史' })).toBeInTheDocument()
  expect(campusFetch.mock.calls.some(([path]) => path === '/api/interview/start')).toBe(false)
})

it('defaults only to the most recent nonempty saved resume without starting', async () => {
  prepareSources([{ id: 'blank', title: '空白', originalText: '', lastModified: '2026-10-22' }, { id: 'older', title: '新建但未再保存', originalText: '旧内容', createdAt: '2026-10-20', lastModified: '2026-10-20' }, { id: 'recent', title: '更早创建但刚保存', originalText: '真实材料', createdAt: '2026-09-01', lastModified: '2026-10-21' }])
  render(<MemoryRouter><InterviewPage /></MemoryRouter>)
  await waitFor(() => expect(screen.getByLabelText('使用哪份已保存简历')).toHaveValue('recent'))
  expect(campusFetch.mock.calls[0][0]).toBe('/api/resumes?sort=-lastModified&limit=100')
  expect(campusFetch.mock.calls.some(([path]) => path === '/api/interview/start')).toBe(false)
})

it('blocks stale save-continue versions until the current source is explicitly chosen', async () => {
  prepareSources([{ id: 'resume', title: '已变化的简历', originalText: '新内容', revision: 3 }])
  render(<MemoryRouter initialEntries={['/interview?resumeId=resume&resumeRevision=2']}><InterviewPage /></MemoryRouter>)
  await screen.findByText(/刚保存的简历版本已变化/)
  fireEvent.change(screen.getByLabelText('岗位或探索方向'), { target: { value: '工程方向' } })
  expect(screen.getByRole('button', { name: '开始中文面试' })).toBeDisabled()
  fireEvent.change(screen.getByLabelText('使用哪份已保存简历'), { target: { value: 'resume' } })
  expect(screen.getByRole('button', { name: '开始中文面试' })).not.toBeDisabled()
})

function CurrentLocation() { const location = useLocation(); return <output aria-label="当前地址">{location.pathname}{location.search}{location.hash}</output> }
it.each(['resume-b', ''])('consumes incoming material selections so refresh retains later resume choice %s', async (nextResume) => {
  const resumes = [{ id: 'resume-a', title: 'A', originalText: 'A内容', revision: 2 }, { id: 'resume-b', title: 'B', originalText: 'B内容', revision: 1 }]
  prepareSources(resumes)
  campusData.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') return JSON.parse(options.body)
    if (path === '/me') return { profile: {}, student: {} }
    if (path === '/me/interview-prep') return null
    return { items: [{ id: 'job-a', title: '岗位A', updatedAt: 'version-a' }, { id: 'job-b', title: '岗位B', updatedAt: 'version-b' }], total: 2 }
  })
  const view = render(<MemoryRouter initialEntries={['/interview?resumeId=resume-a&resumeRevision=2&jobId=job-a&jobRevision=version-a&from=resume']}><CurrentLocation /><InterviewPage /></MemoryRouter>)
  await waitFor(() => expect(screen.getByLabelText('使用哪份已保存简历')).toHaveValue('resume-a'))
  await waitFor(() => expect(screen.getByLabelText('当前地址')).toHaveTextContent('/interview?from=resume'))
  fireEvent.change(screen.getByLabelText('使用哪份已保存简历'), { target: { value: nextResume } })
  fireEvent.change(screen.getByLabelText('测试岗位选择'), { target: { value: 'job-b' } })
  const destination = screen.getByLabelText('当前地址').textContent
  view.unmount()
  render(<MemoryRouter initialEntries={[destination]}><InterviewPage /></MemoryRouter>)
  await waitFor(() => expect(screen.getByLabelText('使用哪份已保存简历')).toHaveValue(nextResume))
  expect(screen.getByLabelText('测试岗位选择')).toHaveValue('job-b')
})

it('does not navigate back when a pending preparation save resolves after departure', async () => {
  let resolveSave
  campusData.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') return new Promise((resolve) => { resolveSave = resolve })
    if (path === '/me') return { profile: {}, student: {} }
    if (path === '/me/interview-prep') return null
    return { items: [], total: 0 }
  })
  campusFetch.mockResolvedValue({ data: [{ id: 'resume-a', title: 'A', originalText: 'A内容', revision: 2 }] })
  render(<MemoryRouter initialEntries={['/interview?resumeId=resume-a&resumeRevision=2']}><CurrentLocation /><Routes><Route path="/interview" element={<><Link to="/elsewhere">离开准备页</Link><InterviewPage /></>} /><Route path="/elsewhere" element={<h1>其他页面</h1>} /></Routes></MemoryRouter>)
  await waitFor(() => expect(screen.getByLabelText('使用哪份已保存简历')).toHaveValue('resume-a'))
  await waitFor(() => expect(resolveSave).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('link', { name: '离开准备页' }))
  expect(screen.getByRole('heading', { name: '其他页面' })).toBeInTheDocument()
  await act(async () => { resolveSave({ saved: true }) })
  expect(screen.getByLabelText('当前地址')).toHaveTextContent('/elsewhere')
  expect(screen.getByRole('heading', { name: '其他页面' })).toBeInTheDocument()
})

it('ignores a pending save completion after the preparation choice is superseded', async () => {
  let resolveSave
  campusData.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') return new Promise((resolve) => { resolveSave = resolve })
    if (path === '/me') return { profile: {}, student: {} }
    if (path === '/me/interview-prep') return null
    return { items: [], total: 0 }
  })
  campusFetch.mockResolvedValue({ data: [{ id: 'resume-a', title: 'A', originalText: 'A内容', revision: 2 }] })
  render(<MemoryRouter initialEntries={['/interview?resumeId=resume-a&resumeRevision=2']}><CurrentLocation /><InterviewPage /></MemoryRouter>)
  await waitFor(() => expect(resolveSave).toBeTypeOf('function'))
  fireEvent.change(screen.getByLabelText('使用哪份已保存简历'), { target: { value: '' } })
  fireEvent.change(screen.getByLabelText('这次带入的真实经历'), { target: { value: '新的准备文字' } })
  await act(async () => { resolveSave({ saved: true }) })
  expect(screen.getByLabelText('当前地址')).toHaveTextContent(/^\/interview$/)
  expect(screen.getByLabelText('使用哪份已保存简历')).toHaveValue('')
  expect(screen.getByLabelText('这次带入的真实经历')).toHaveValue('新的准备文字')
  expect(screen.queryByText('准备单已保存在当前账号下。')).not.toBeInTheDocument()
})

function mobileViewport() {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
}

function BrowserHistory() {
  const navigate = useNavigate()
  return <><button onClick={() => navigate(-1)}>浏览器后退</button><button onClick={() => navigate(1)}>浏览器前进</button></>
}

it('opens a visible native role field when mobile start cannot use the current defaults', async () => {
  mobileViewport()
  prepareSources([])
  render(<MemoryRouter initialEntries={['/interview?from=resume#prep']}><CurrentLocation /><InterviewPage /></MemoryRouter>)
  const start = screen.getByRole('button', { name: '开始中文面试' })
  await waitFor(() => expect(start).toBeEnabled())
  const role = screen.getByLabelText('岗位或探索方向')
  expect(role).not.toBeVisible()
  expect(role).toBeDisabled()
  const invalid = vi.fn()
  role.addEventListener('invalid', invalid)
  fireEvent.click(start)
  expect(screen.getByLabelText('当前地址')).toHaveTextContent('/interview?from=resume&panel=direction#prep')
  expect(role).toBeVisible()
  expect(role).toHaveFocus()
  expect(invalid).toHaveBeenCalledOnce()
  expect(campusFetch.mock.calls.some(([path]) => path === '/api/interview/start')).toBe(false)
})

it('retains the mobile preparation across Back and Forward and starts with the current values', async () => {
  mobileViewport()
  prepareSources([])
  campusFetch.mockImplementation(async (path) => path === '/api/interview/start' ? { data: { interviewId: 'session' } } : { data: [] })
  render(<MemoryRouter initialEntries={['/interview?from=resume&panel=direction']}><BrowserHistory /><Routes>
    <Route path="/interview" element={<InterviewPage />} />
    <Route path="/interview/session/session" element={<h1>开始练习</h1>} />
  </Routes></MemoryRouter>)
  const role = screen.getByLabelText('岗位或探索方向')
  await waitFor(() => expect(role).toBeEnabled())
  fireEvent.change(role, { target: { value: '工程方向' } })
  fireEvent.click(screen.getByRole('button', { name: '返回面试准备' }))
  fireEvent.click(screen.getByRole('button', { name: /练习材料/ }))
  fireEvent.change(screen.getByLabelText('这次带入的真实经历'), { target: { value: '课程项目' } })
  fireEvent.click(screen.getByRole('button', { name: '浏览器后退' }))
  expect(screen.getByRole('heading', { name: '面试准备' })).toHaveFocus()
  fireEvent.click(screen.getByRole('button', { name: '浏览器前进' }))
  expect(screen.getByLabelText('这次带入的真实经历')).toHaveValue('课程项目')
  fireEvent.click(screen.getByRole('button', { name: '返回面试准备' }))
  fireEvent.click(screen.getByRole('button', { name: /练习设置/ }))
  fireEvent.change(screen.getByLabelText('题数'), { target: { value: '6' } })
  fireEvent.click(screen.getByRole('button', { name: '返回面试准备' }))
  fireEvent.click(screen.getByRole('button', { name: '开始中文面试' }))
  await screen.findByRole('heading', { name: '开始练习' })
  const [, start] = campusFetch.mock.calls.find(([path]) => path === '/api/interview/start')
  expect(JSON.parse(start.body)).toMatchObject({ jobRole: '工程方向', resumeText: '课程项目', questionCount: 6, mode: 'mixed' })
  expect(campusData.mock.calls.filter(([path, options]) => path === '/me/interview-prep' && !options)).toHaveLength(1)
})

it('does not reopen the screenshot handoff after leaving and returning to the original history entry', async () => {
  mobileViewport()
  let resolveSave
  prepareSources([])
  campusData.mockImplementation(async (path, options) => {
    if (options?.method === 'PUT') return new Promise((resolve) => { resolveSave = resolve })
    if (path === '/me') return { profile: {}, student: {} }
    if (path === '/me/interview-prep') return null
    return { items: [], total: 0 }
  })
  render(<MemoryRouter initialEntries={['/interview']}><BrowserHistory /><Routes>
    <Route path="/interview" element={<InterviewPage />} />
    <Route path="/jd" element={<JobRoute />} />
  </Routes></MemoryRouter>)
  const direction = screen.getByRole('button', { name: /练习方向/ })
  await waitFor(() => expect(direction).toBeEnabled())
  fireEvent.click(direction)
  const handoff = screen.getByRole('button', { name: /上传岗位截图/ })
  await waitFor(() => expect(handoff).toBeEnabled())
  fireEvent.click(handoff)
  await waitFor(() => expect(resolveSave).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('button', { name: '返回面试准备' }))
  fireEvent.click(screen.getByRole('button', { name: '浏览器前进' }))
  await act(async () => { resolveSave({ saved: true }) })
  expect(screen.getByRole('heading', { name: '练习方向' })).toBeVisible()
  expect(screen.queryByText(/岗位入口：/)).not.toBeInTheDocument()
})

it('opens Materials instead of starting with a stale incoming resume revision on mobile', async () => {
  mobileViewport()
  prepareSources([{ id: 'resume-a', title: '简历 A', originalText: 'A内容', revision: 3 }])
  saveInterviewPrep('student', { ...emptyPrep(), jobRole: '工程方向', manualRole: '工程方向' })
  render(<MemoryRouter initialEntries={['/interview?resumeId=resume-a&resumeRevision=2']}><CurrentLocation /><InterviewPage /></MemoryRouter>)
  const start = screen.getByRole('button', { name: '开始中文面试' })
  await waitFor(() => expect(start).toBeEnabled())
  fireEvent.click(start)
  expect(screen.getByRole('heading', { name: '练习材料' })).toHaveFocus()
  expect(screen.getByText(/刚保存的简历版本已变化/)).toBeVisible()
  expect(screen.getByLabelText('当前地址')).toHaveTextContent('resumeId=resume-a&resumeRevision=2&panel=materials')
  expect(campusFetch.mock.calls.some(([path]) => path === '/api/interview/start')).toBe(false)
})

it.each([
  ['/interview', '/interview?panel=settings'],
  ['/interview?panel=settings', '/elsewhere'],
])('returns from mobile settings without appending another overview (%s)', async (entry, afterBack) => {
  mobileViewport()
  prepareSources([])
  render(<MemoryRouter initialEntries={['/elsewhere', entry]}><CurrentLocation /><BrowserHistory /><Routes>
    <Route path="/interview" element={<InterviewPage />} />
    <Route path="/elsewhere" element={<h1>其他页面</h1>} />
  </Routes></MemoryRouter>)
  if (entry === '/interview') {
    const settings = screen.getByRole('button', { name: /练习设置/ })
    await waitFor(() => expect(settings).toBeEnabled())
    fireEvent.click(settings)
  }
  fireEvent.click(screen.getByRole('button', { name: '返回面试准备' }))
  expect(screen.getByLabelText('当前地址')).toHaveTextContent(/^\/interview$/)
  if (entry === '/interview') fireEvent.click(screen.getByRole('button', { name: '浏览器前进' }))
  else fireEvent.click(screen.getByRole('button', { name: '浏览器后退' }))
  expect(screen.getByLabelText('当前地址').textContent).toBe(afterBack)
})

it('offers an explicit resume link for a mobile interview created after departure', async () => {
  mobileViewport()
  prepareSources([])
  saveInterviewPrep('student', { ...emptyPrep(), jobRole: '工程方向', manualRole: '工程方向' })
  let finishStart
  let created = false
  campusFetch.mockImplementation(async (path) => {
    if (path === '/api/interview/start') return new Promise((resolve) => {
      finishStart = () => { created = true; resolve({ data: { interviewId: 'session' } }) }
    })
    if (path === '/api/interview/history') return { data: [
      { _id: 'discovery', purpose: 'discovery', status: 'in_progress' },
      ...(created ? [{ _id: 'session', jobRole: '工程方向', purpose: 'interview', status: 'in_progress' }] : []),
    ] }
    return { data: [] }
  })
  render(<MemoryRouter initialEntries={['/interview']}><CurrentLocation /><Routes>
    <Route path="/interview" element={<InterviewPage />} />
    <Route path="/history" element={<Link to="/interview">返回准备</Link>} />
    <Route path="/interview/session/session" element={<h1>开始练习</h1>} />
  </Routes></MemoryRouter>)
  const start = screen.getByRole('button', { name: '开始中文面试' })
  await waitFor(() => expect(start).toBeEnabled())
  fireEvent.click(start)
  await waitFor(() => expect(finishStart).toBeTypeOf('function'))
  fireEvent.click(screen.getByRole('link', { name: '查看以前的练习' }))
  await act(async () => { finishStart() })
  expect(screen.getByLabelText('当前地址')).toHaveTextContent('/history')
  fireEvent.click(screen.getByRole('link', { name: '返回准备' }))
  const resume = await screen.findByRole('link', { name: '继续上次面试' })
  expect(resume).toHaveAttribute('href', '/interview/session/session')
  fireEvent.click(resume)
  expect(screen.getByRole('heading', { name: '开始练习' })).toBeVisible()
})
