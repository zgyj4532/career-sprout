import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import JobImageImport from '../JobImageImport'
import { campusData, campusFetch } from '../../api'
vi.mock('../../api', () => ({ campusData: vi.fn(), campusFetch: vi.fn(), downloadDiagnostics: vi.fn(), errorText: (error) => error?.message }))
beforeEach(() => { URL.createObjectURL = vi.fn(() => 'blob:preview'); URL.revokeObjectURL = vi.fn() })
afterEach(() => { cleanup(); vi.clearAllMocks() })
it('uploads real files in the chosen order and requires a job choice', async () => {
  const onChoose = vi.fn()
  const ready = { id: 'images', status: 'ready', files: [{ id: 'image-1', index: 0 }, { id: 'image-2', index: 1 }], candidates: [{ id: 'a', title: '开发', company: '甲', city: '上海', sourcePages: [1] }, { id: 'b', title: '开发', company: '甲', city: '杭州', sourcePages: [2] }] }
  campusData.mockImplementation(async (path) => path === '/jobs/images' ? { items: [] } : ready)
  render(<JobImageImport onChoose={onChoose} />)
  fireEvent.click(screen.getByRole('button', { name: '从岗位截图整理' }))
  const first = new File(['a'], 'first.png', { type: 'image/png' })
  const second = new File(['b'], 'second.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('添加岗位截图'), { target: { files: [first, second] } })
  fireEvent.click(screen.getAllByRole('button', { name: '上移' })[1])
  campusData.mockImplementation(async (_path, options) => options?.method === 'POST' ? ready : { items: [] })
  fireEvent.click(screen.getByRole('button', { name: '读取这些截图' }))
  await waitFor(() => expect(campusData.mock.calls.some(([, options]) => options?.body instanceof FormData)).toBe(true))
  const sent = campusData.mock.calls.find(([, options]) => options?.body instanceof FormData)[1].body.getAll('images')
  expect(sent.map((file) => file.name)).toEqual(['second.png', 'first.png'])
  expect(await screen.findByRole('button', { name: '使用这个岗位，核对后保存' })).toBeDisabled()
  fireEvent.click(screen.getAllByRole('radio')[1])
  fireEvent.click(screen.getByRole('button', { name: '使用这个岗位，核对后保存' }))
  expect(onChoose).toHaveBeenCalledWith(ready.candidates[1], 'images')
})
it('recovers original images without making another model request', async () => {
  const draft = { id: 'images', status: 'failed', canContinue: false, files: [{ id: 'image-1', index: 0 }], candidates: [] }
  campusData.mockImplementation(async (path) => path === '/jobs/images' ? { items: [draft] } : draft)
  campusFetch.mockResolvedValue(new Blob(['image'], { type: 'image/png' }))
  render(<JobImageImport onChoose={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: '岗位截图 · failed' }))
  expect(await screen.findByAltText('岗位截图 1')).toBeInTheDocument()
  expect(campusFetch).toHaveBeenCalledWith('/api/campus/jobs/images/images/source/0', { responseType: 'blob' })
  expect(screen.queryByRole('button', { name: '继续读取已收到的截图' })).not.toBeInTheDocument()
  expect(campusData.mock.calls.every(([, options]) => !options?.method)).toBe(true)
})

it('selects a sole recovered candidate and keeps discard available when its original is missing', async () => {
  const candidate = { id: 'only', title: '真实岗位', company: '企业', sourcePages: [1] }
  const draft = { id: 'images', status: 'ready', files: [{ id: 'image-1', index: 0 }], candidates: [candidate] }
  campusData.mockImplementation(async (path) => path === '/jobs/images' ? { items: [draft] } : draft)
  campusFetch.mockRejectedValue(new Error('原图不可用'))
  const onChoose = vi.fn()
  render(<JobImageImport onChoose={onChoose} />)
  fireEvent.click(await screen.findByRole('button', { name: '岗位截图 · ready' }))
  expect(await screen.findByText('这张原图不可用，可丢弃导入后更换文件。')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('button', { name: '使用这个岗位，核对后保存' })).toBeEnabled())
  expect(screen.getByRole('button', { name: '丢弃这组截图与原件' })).toBeEnabled()
  fireEvent.click(screen.getByRole('button', { name: '使用这个岗位，核对后保存' }))
  expect(onChoose).toHaveBeenCalledWith(candidate, 'images')
})

it('loads older retained screenshot records without replacing recent records', async () => {
  campusData.mockImplementation(async (path) => path.includes('?') ? { items: [{ id: 'older', title: '旧截图', status: 'saved' }], total: 2, page: 2 } : { items: [{ id: 'recent', title: '新截图', status: 'saved' }], total: 2, page: 1 })
  render(<JobImageImport onChoose={vi.fn()} />)
  fireEvent.click(await screen.findByRole('button', { name: '加载更多截图记录' }))
  expect(await screen.findByRole('button', { name: '旧截图 · saved' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '新截图 · saved' })).toBeInTheDocument()
})
