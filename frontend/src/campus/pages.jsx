import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { campusFetch, errorText } from './api'
import BlurText from './bits/BlurText'
import SpotlightCard from './bits/SpotlightCard'
import { CORE_NAV } from './nav'

const STUDY_STAGES = ['大一', '大二', '大三', '大四', '已毕业']

const SAMPLE_RESUME = `# 示例学生（测试数据，不是真实经历）

计算机专业本科在读。熟悉 JavaScript 和团队项目协作。

## 项目
- 课程项目：用 React 做了一个待办清单，支持本地保存。
`

export function HomePage() {
  return (
    <section className="campus-hero-text">
      <BlurText
        as="h1"
        className="campus-hero-title"
        text="咱平时啊，在大学咱们就练起来"
        animateBy="chars"
        direction="top"
        delay={60}
      />
      <p className="campus-hero-subtitle">四个入口就够先练。没配好的服务会直接说明，不会装成已经成功。</p>
      <div className="campus-portal-grid">
        {CORE_NAV.map(({ to, label, copy, Icon }) => (
          <Link className="campus-portal-card-link" key={to} to={to}>
            <SpotlightCard className="campus-portal-card" spotlightColor="rgba(19, 108, 83, 0.08)">
              <div className="campus-card-icon-box"><Icon /></div>
              <h2 className="campus-card-title">{label}</h2>
              <p className="campus-card-desc">{copy}</p>
              <div className="campus-card-watermark" aria-hidden="true"><Icon /></div>
            </SpotlightCard>
          </Link>
        ))}
      </div>
    </section>
  )
}

function useStatus() {
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  return { error, setError, note, setNote }
}

export function ResumePage() {
  const { error, setError, note, setNote } = useStatus()
  const [resumes, setResumes] = useState([])
  const [currentId, setCurrentId] = useState('')
  const [title, setTitle] = useState('校园简历')
  const [jobRole, setJobRole] = useState('软件开发实习生')
  const [text, setText] = useState(SAMPLE_RESUME)
  const [busy, setBusy] = useState(false)
  const [pdfToast, setPdfToast] = useState('')

  async function loadList() {
    const payload = await campusFetch('/api/resumes')
    const rows = payload.data?.data || payload.data || []
    setResumes(Array.isArray(rows) ? rows : [])
  }

  useEffect(() => {
    loadList().catch((err) => setError(errorText(err)))
  }, [])

  async function save(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNote('')
    try {
      const body = JSON.stringify({ title, jobRole, originalText: text })
      const saved = currentId
        ? await campusFetch(`/api/resumes/${currentId}`, { method: 'PUT', body })
        : await campusFetch('/api/resumes', { method: 'POST', body })
      const id = saved.data?.id
      setCurrentId(id)
      const reloaded = await campusFetch(`/api/resumes/${id}`)
      setText(reloaded.data?.originalText || text)
      setTitle(reloaded.data?.title || title)
      setNote('已保存，并重新读取了服务器上的内容。')
      await loadList()
    } catch (err) {
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  async function download() {
    if (!currentId) {
      setPdfToast('请先保存简历，再导出 PDF。')
      return
    }
    setPdfToast('正在下载pdf中')
    setBusy(true)
    setError('')
    try {
      const blob = await campusFetch(`/api/resumes/${currentId}/download?version=original&paperSize=A4`)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${title || 'resume'}.pdf`
      link.click()
      URL.revokeObjectURL(url)
      setPdfToast('PDF 已开始下载')
      setNote('请打开文件检查中文是否缺字或被裁切。')
    } catch (err) {
      setPdfToast(errorText(err))
      setError(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="resume-page">
      {pdfToast && <div className="campus-toast" role="status">{pdfToast}</div>}
      <header className="resume-page-header">
        <h1 className="resume-page-title">做简历</h1>
        <p className="resume-page-desc">默认示例已标明不是真实经历。保存失败时，下面的正文会保留。</p>
      </header>
      {error && <div className="campus-error">{error}</div>}
      {note && <div className="campus-note">{note}</div>}
      <div className="resume-workspace">
        <form className="campus-card resume-editor-card" onSubmit={save}>
          <div className="resume-meta-row">
            <div className="resume-field">
              <label className="resume-label" htmlFor="resume-title">标题</label>
              <input id="resume-title" className="resume-input" value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="resume-field">
              <label className="resume-label" htmlFor="resume-role">目标岗位</label>
              <input id="resume-role" className="resume-input" value={jobRole} onChange={(event) => setJobRole(event.target.value)} />
            </div>
          </div>
          <div className="resume-field resume-body-field">
            <div className="resume-label-row">
              <label className="resume-label" htmlFor="resume-body">正文 <span className="resume-label-hint">（支持 Markdown 标题与列表格式）</span></label>
              <button type="button" className="btn-text-action" onClick={() => { setCurrentId(''); setText(SAMPLE_RESUME); setNote('已填入示例数据，不是真实经历。') }}>填入示例内容</button>
            </div>
            <textarea id="resume-body" className="resume-textarea" value={text} onChange={(event) => setText(event.target.value)} />
          </div>
          <div className="resume-actions-bar">
            <button className="btn-primary" type="submit" disabled={busy}>保存</button>
            <button className="btn-secondary" type="button" onClick={download} disabled={busy}>导出 PDF</button>
          </div>
        </form>
        <aside className="campus-card resume-sidebar">
          <div className="resume-sidebar-header">
            <h2 className="resume-sidebar-title">已保存的简历</h2>
            <span className="resume-count-badge">{resumes.length} 份</span>
          </div>
          <ul className="resume-saved-list">
            {resumes.map((resume) => (
              <li key={resume.id}>
                <button
                  type="button"
                  className={currentId === resume.id ? 'resume-saved-item is-active' : 'resume-saved-item'}
                  onClick={() => {
                    setCurrentId(resume.id)
                    setTitle(resume.title || '')
                    setJobRole(resume.jobRole || '')
                    setText(resume.originalText || '')
                  }}
                >
                  <span className="resume-item-title">{resume.title || resume.id}</span>
                </button>
              </li>
            ))}
          </ul>
          {resumes.length === 0 && <p className="resume-empty">还没有保存的简历。</p>}
        </aside>
      </div>
    </section>
  )
}

export function JdPage() {
  const { error, setError, note, setNote } = useStatus()
  const [text, setText] = useState('招聘软件开发实习生。要求熟悉 JavaScript、Git，能阅读接口文档并完成课程项目。')
  const [parsed, setParsed] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [resumeText, setResumeText] = useState(SAMPLE_RESUME)

  async function parseJd(event) {
    event.preventDefault()
    setError('')
    setNote('')
    setAnalysis(null)
    try {
      const result = await campusFetch('/api/interview/parse-jd', {
        method: 'POST',
        body: JSON.stringify({ text }),
      })
      setParsed(result.data)
      setNote('已整理粘贴的岗位文本。这不是招聘网站抓取，也还不是 AI 匹配。')
    } catch (err) {
      setError(errorText(err))
    }
  }

  async function analyze() {
    setError('')
    try {
      const result = await campusFetch('/api/enhance/skill-gap', {
        method: 'POST',
        body: JSON.stringify({ resumeText, jobDescription: text }),
      })
      setAnalysis(result.data || result)
    } catch (err) {
      setAnalysis(null)
      setError(errorText(err))
    }
  }

  return (
    <section className="campus-form">
      <h1>分析岗位</h1>
      <p>只接受粘贴的岗位描述。没有 AI 密钥时，匹配会失败并保留你输入的文本。</p>
      {error && <div className="campus-error">{error}</div>}
      {note && <div className="campus-note">{note}</div>}
      <form className="campus-form" onSubmit={parseJd}>
        <label>岗位描述<textarea value={text} onChange={(event) => setText(event.target.value)} /></label>
        <label>用于对照的简历<textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} /></label>
        <div className="campus-actions">
          <button className="primary" type="submit">整理岗位文本</button>
          <button type="button" onClick={analyze}>对比技能差距</button>
        </div>
      </form>
      {parsed && <pre className="campus-panel">{JSON.stringify(parsed, null, 2)}</pre>}
      {analysis && <pre className="campus-panel">{JSON.stringify(analysis, null, 2)}</pre>}
    </section>
  )
}

function chineseVoice() {
  const voices = window.speechSynthesis?.getVoices?.() || []
  return voices.find((voice) => /zh|chinese|中文/i.test(`${voice.lang} ${voice.name}`)) || null
}

function textList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function FeedbackView({ analysis }) {
  const [open, setOpen] = useState(false)
  if (!analysis) return null
  return (
    <article className="campus-feedback">
      <div className="campus-feedback-bar">
        <div className="campus-scores">
          <span>贴题 {analysis.relevance ?? '—'}</span>
          <span>清楚 {analysis.clarity ?? '—'}</span>
          <span>信心 {analysis.confidence ?? '—'}</span>
        </div>
        <button type="button" className="campus-fold" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? '收起' : '展开'}
        </button>
      </div>
      {open && (
        <div className="campus-feedback-body">
          {analysis.feedback && <p>{analysis.feedback}</p>}
          {analysis.keyTakeaway && <p><strong>下次先改：</strong>{analysis.keyTakeaway}</p>}
          {textList(analysis.whatYouDidWell).length > 0 && (
            <div><strong>做得好的</strong><ul>{textList(analysis.whatYouDidWell).map((item) => <li key={item}>{item}</li>)}</ul></div>
          )}
          {textList(analysis.whatWasMissing).length > 0 && (
            <div><strong>还缺的</strong><ul>{textList(analysis.whatWasMissing).map((item) => <li key={item}>{item}</li>)}</ul></div>
          )}
          {textList(analysis.suggestions).length > 0 && (
            <div><strong>可以这样改</strong><ul>{textList(analysis.suggestions).map((item) => <li key={item}>{item}</li>)}</ul></div>
          )}
          {analysis.idealAnswer && <p><strong>参考答法：</strong>{analysis.idealAnswer}</p>}
        </div>
      )}
    </article>
  )
}

function OverallView({ score, feedback }) {
  const [open, setOpen] = useState(false)
  if (!feedback) return null
  return (
    <article className="campus-feedback">
      <div className="campus-feedback-bar">
        <h2>这次总评 {score ?? '—'}</h2>
        <button type="button" className="campus-fold" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? '收起' : '展开'}
        </button>
      </div>
      {open && (
        <div className="campus-feedback-body">
          {feedback.summary && <p>{feedback.summary}</p>}
          {textList(feedback.topStrengths).length > 0 && <div><strong>优势</strong><ul>{textList(feedback.topStrengths).map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {textList(feedback.areasToImprove).length > 0 && <div><strong>要补的</strong><ul>{textList(feedback.areasToImprove).map((item) => <li key={item}>{item}</li>)}</ul></div>}
          {textList(feedback.recommendations).length > 0 && <div><strong>下一步</strong><ul>{textList(feedback.recommendations).map((item) => <li key={item}>{item}</li>)}</ul></div>}
        </div>
      )}
    </article>
  )
}

export function InterviewPage() {
  const navigate = useNavigate()
  const { error, setError, note, setNote } = useStatus()
  const [jobRole, setJobRole] = useState('软件开发实习生')
  const [resumeText, setResumeText] = useState(SAMPLE_RESUME)
  const [busy, setBusy] = useState(false)

  async function start(event) {
    event.preventDefault()
    setError('')
    setNote('')
    setBusy(true)
    try {
      const result = await campusFetch('/api/interview/start', {
        method: 'POST',
        body: JSON.stringify({
          jobRole,
          industry: '校园招聘',
          experienceLevel: 'student',
          questionCount: 4,
          language: 'zh',
          mode: 'behavioral',
          resumeText,
          skipWarmup: true,
        }),
      })
      const id = result.data?.interviewId
      if (!id) throw new Error('没有返回面试编号')
      navigate(`/interview/session/${id}`)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <section className="campus-form">
      <h1>练面试</h1>
      <p>点开始后会进入中文面试页。那里会标明 AI 正在说话、正在录音，并留下语音记录。</p>
      {error && <div className="campus-error">{error}</div>}
      {note && <div className="campus-note">{note}</div>}
      <form className="campus-form" onSubmit={start}>
        <label>岗位<input value={jobRole} onChange={(event) => setJobRole(event.target.value)} /></label>
        <label>简历上下文<textarea value={resumeText} onChange={(event) => setResumeText(event.target.value)} /></label>
        <button className="primary" type="submit" disabled={busy}>{busy ? '正在进入面试' : '开始中文面试'}</button>
      </form>
      <Link to="/history">历史档案</Link>
    </section>
  )
}

function formatClock(seconds) {
  const total = Math.max(0, Math.floor(seconds || 0))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function InterviewerOrb({ speaking, amplitude }) {
  const mouth = speaking ? Math.min(1, 0.3 + amplitude * 0.7) : 0
  return (
    <div className={`campus-orb${speaking ? ' is-speaking' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 200 200">
        <defs>
          <linearGradient id="campus-orb" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r="68" fill="url(#campus-orb)" />
        <circle cx="76" cy={speaking ? 88 : 92} r="6" fill="#0f172a" />
        <circle cx="124" cy={speaking ? 88 : 92} r="6" fill="#0f172a" />
        <circle cx="78" cy={speaking ? 86 : 90} r="2" fill="#f8fafc" />
        <circle cx="126" cy={speaking ? 86 : 90} r="2" fill="#f8fafc" />
        <ellipse cx="100" cy="128" rx={10 + mouth * 12} ry={2 + mouth * 14} fill="#0f172a" />
      </svg>
      <span>{speaking ? '面试官正在说话' : '面试官'}</span>
    </div>
  )
}

function scoreLabel(score) {
  if (score >= 90) return '很好'
  if (score >= 80) return '不错'
  if (score >= 70) return '合格'
  if (score >= 60) return '一般'
  return '还要练'
}

function RoomReport({ item, summary }) {
  const answers = item?.answers || []
  const feedback = summary?.overallFeedback || item?.overallFeedback
  const score = summary?.overallScore ?? item?.overallScore
  const avg = (key) => {
    if (!answers.length) return 0
    return Math.round(answers.reduce((sum, answer) => sum + (answer.analysis?.[key] || 0), 0) / answers.length)
  }
  const bars = [
    ['贴题程度', avg('relevance')],
    ['表达清楚', avg('clarity')],
    ['口头信心', avg('confidence')],
  ]
  return (
    <section className="campus-report">
      <p className="campus-kicker">面试结束</p>
      <h1>这次练完了</h1>
      <div className="campus-score-row">
        <div className="campus-score-ring" style={{ '--score': `${Math.max(0, Math.min(100, score || 0))}%` }}>
          <strong>{score ?? '—'}</strong>
          <span>{score == null ? '没有分数' : scoreLabel(score)}</span>
        </div>
        <div className="campus-bars">
          {bars.map(([label, value]) => (
            <div key={label}>
              <div><span>{label}</span><strong>{value}</strong></div>
              <i style={{ width: `${value}%` }} />
            </div>
          ))}
          {feedback?.summary && <p>{feedback.summary}</p>}
        </div>
      </div>
      {textList(feedback?.topStrengths).length > 0 && <div className="campus-panel"><strong>优势</strong><ul>{textList(feedback.topStrengths).map((row) => <li key={row}>{row}</li>)}</ul></div>}
      {textList(feedback?.areasToImprove).length > 0 && <div className="campus-panel"><strong>要补的</strong><ul>{textList(feedback.areasToImprove).map((row) => <li key={row}>{row}</li>)}</ul></div>}
      {textList(feedback?.recommendations).length > 0 && <div className="campus-panel"><strong>下一步</strong><ul>{textList(feedback.recommendations).map((row) => <li key={row}>{row}</li>)}</ul></div>}
      {answers.map((answer, index) => (
        <article className="campus-turn" key={answer.questionId || index}>
          <h2>第 {index + 1} 题</h2>
          <p><strong>问题：</strong>{answer.question}</p>
          <p><strong>你的回答：</strong>{answer.transcript || '没有保存回答文本。'}</p>
          <FeedbackView analysis={answer.analysis} />
        </article>
      ))}
      <Link className="button" to="/history">回历史档案</Link>
    </section>
  )
}

export function InterviewSessionPage() {
  const { id } = useParams()
  const { error, setError } = useStatus()
  const [item, setItem] = useState(null)
  const [phase, setPhase] = useState('loading')
  const [typing, setTyping] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [seconds, setSeconds] = useState(0)
  const [videoOn, setVideoOn] = useState(false)
  const [audioOn, setAudioOn] = useState(false)
  const [amplitude, setAmplitude] = useState(0)
  const [summary, setSummary] = useState(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const rafRef = useRef(null)
  const questionRef = useRef(null)
  const busyRef = useRef(false)
  const secondsRef = useRef(0)
  const itemRef = useRef(null)

  const questions = item?.questions || []
  const answered = new Set((item?.answers || []).map((answer) => answer.questionId))
  const question = questions.find((entry) => !answered.has(entry.questionId)) || null
  const questionIndex = question ? questions.findIndex((entry) => entry.questionId === question.questionId) : questions.length
  const total = item?.totalQuestionCount || questions.length || 1
  const progress = Math.round(((Math.min(questionIndex, total - 1) + 1) / total) * 100)
  questionRef.current = question
  itemRef.current = item

  function stopWave() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') audioCtxRef.current.close().catch(() => {})
    audioCtxRef.current = null
  }

  function stopTimer() {
    clearInterval(timerRef.current)
    timerRef.current = null
  }

  function releaseStream() {
    stopWave()
    stopTimer()
    recorderRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  async function attachStream(withVideo) {
    if (streamRef.current) return streamRef.current
    const constraints = withVideo
      ? { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true }
      : { audio: true }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    streamRef.current = stream
    setVideoOn(stream.getVideoTracks().some((track) => track.enabled))
    setAudioOn(stream.getAudioTracks().some((track) => track.enabled))
    if (videoRef.current && stream.getVideoTracks().length) videoRef.current.srcObject = stream
    return stream
  }

  function speak(text) {
    return new Promise((resolve) => {
      if (!text || !window.speechSynthesis) {
        setError('浏览器不能播报。题目在右边，可以直接录音或打字。')
        resolve()
        return
      }
      const voice = chineseVoice()
      if (!voice) {
        setError('没有中文音色。题目仍会显示，播报不算成功。')
        resolve()
        return
      }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.voice = voice
      utterance.lang = voice.lang || 'zh-CN'
      utterance.rate = 0.95
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
    })
  }

  async function announce(next) {
    if (!next?.question) return
    setTranscript('')
    setTyping(false)
    setPhase('speaking')
    setError('')
    await speak(next.question)
    setPhase('idle')
  }

  useEffect(() => {
    if (phase !== 'speaking') {
      setAmplitude(0)
      return undefined
    }
    const timer = setInterval(() => setAmplitude(0.25 + Math.random() * 0.65), 120)
    return () => clearInterval(timer)
  }, [phase])

  useEffect(() => {
    let cancelled = false
    campusFetch(`/api/interview/${id}`)
      .then(async (payload) => {
        if (cancelled) return
        const data = payload.data
        setItem(data)
        if (data.status === 'completed') {
          setSummary({ overallScore: data.overallScore, overallFeedback: data.overallFeedback })
          setPhase('done')
          return
        }
        try {
          await attachStream(true)
        } catch {
          try { await attachStream(false) } catch { setError('摄像头和麦克风都没打开。点「开始录音」会再要一次权限。') }
        }
        const done = new Set((data.answers || []).map((answer) => answer.questionId))
        const next = (data.questions || []).find((entry) => !done.has(entry.questionId))
        if (!next) {
          setPhase('idle')
          return
        }
        await announce(next)
      })
      .catch((err) => {
        setPhase('idle')
        setError(errorText(err))
      })
    return () => {
      cancelled = true
      window.speechSynthesis?.cancel()
      releaseStream()
    }
  }, [id])

  function drawWave(stream) {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 1024
    source.connect(analyser)
    audioCtxRef.current = audioContext
    const data = new Uint8Array(analyser.fftSize)
    const loop = () => {
      analyser.getByteTimeDomainData(data)
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.strokeStyle = '#38bdf8'
      context.lineWidth = 2
      context.beginPath()
      const step = canvas.width / data.length
      for (let index = 0; index < data.length; index += 1) {
        const y = (data[index] / 255) * canvas.height
        if (index === 0) context.moveTo(0, y)
        else context.lineTo(index * step, y)
      }
      context.stroke()
      rafRef.current = requestAnimationFrame(loop)
    }
    loop()
  }

  async function startRecording() {
    if (phase === 'speaking' || busyRef.current) return
    setError('')
    try {
      const stream = streamRef.current || await attachStream(true)
      if (!stream.getAudioTracks().length) throw new Error('没有麦克风')
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : ''
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        const duration = secondsRef.current
        stopWave()
        transcribeAndSubmit(blob, duration)
      }
      recorder.start(250)
      recorderRef.current = recorder
      setSeconds(0)
      secondsRef.current = 0
      timerRef.current = setInterval(() => {
        secondsRef.current += 1
        setSeconds(secondsRef.current)
      }, 1000)
      drawWave(stream)
      setPhase('recording')
    } catch (err) {
      setPhase('idle')
      setError(err.name === 'NotAllowedError' ? '麦克风被拒绝。可以改成打字，这次不算语音通过。' : errorText(err))
    }
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
    stopTimer()
    setPhase('transcribing')
  }

  async function finish(current) {
    setPhase('summary')
    const result = await campusFetch(`/api/interview/${id}/complete`, { method: 'POST' })
    setSummary(result.data)
    setItem(current)
    setPhase('done')
    releaseStream()
  }

  async function submitTranscript(text, duration) {
    const currentQuestion = questionRef.current
    if (!currentQuestion || !text.trim() || busyRef.current) {
      setPhase('idle')
      if (!text.trim()) setError('没有可用的回答。请重新录音，或改成打字。')
      return
    }
    busyRef.current = true
    setPhase('analyzing')
    setError('')
    try {
      const form = new FormData()
      form.append('questionId', currentQuestion.questionId)
      form.append('transcript', text.trim())
      form.append('duration', String(duration || 0))
      form.append('isWarmup', 'false')
      const result = await campusFetch(`/api/interview/${id}/answer`, { method: 'POST', body: form })
      const nextItem = {
        ...itemRef.current,
        answers: [...(itemRef.current?.answers || []), {
          questionId: currentQuestion.questionId,
          question: currentQuestion.question,
          transcript: text.trim(),
          analysis: result.data?.analysis,
          duration,
        }],
      }
      setItem(nextItem)
      itemRef.current = nextItem
      setTranscript('')
      const next = result.data?.nextQuestion
      if (next?.question) {
        questionRef.current = next
        busyRef.current = false
        await announce(next)
        return
      }
      await finish(nextItem)
    } catch (err) {
      setPhase('idle')
      setError(errorText(err))
    } finally {
      busyRef.current = false
    }
  }

  async function transcribeAndSubmit(blob, duration) {
    if (!blob.size) {
      setPhase('idle')
      setError('录音是空的，没有生成转写。')
      return
    }
    setPhase('transcribing')
    const form = new FormData()
    form.append('audio', blob, 'answer.webm')
    form.append('language', 'zh')
    try {
      const result = await campusFetch('/api/interview/transcribe', { method: 'POST', body: form })
      const text = result.data?.text || ''
      setTranscript(text)
      await submitTranscript(text, duration)
    } catch (err) {
      setPhase('idle')
      setError(errorText(err))
    }
  }



  async function toggleTrack(kind) {
    if (phase === 'recording') return
    const tracks = kind === 'video' ? streamRef.current?.getVideoTracks() : streamRef.current?.getAudioTracks()
    if (!tracks?.length) {
      releaseStream()
      try {
        await attachStream(true)
      } catch (err) {
        setError(err.name === 'NotAllowedError' ? '浏览器拒绝了摄像头或麦克风。' : errorText(err))
      }
      return
    }
    const enabled = !tracks[0].enabled
    tracks.forEach((track) => { track.enabled = enabled })
    if (kind === 'video') setVideoOn(enabled)
    else setAudioOn(enabled)
  }

  if (phase === 'done' || item?.status === 'completed') {
    return <RoomReport item={item} summary={summary} />
  }

  const busy = phase === 'transcribing' || phase === 'analyzing' || phase === 'summary'
  const status = phase === 'speaking' ? '面试官正在说话' : phase === 'recording' ? '正在录音' : phase === 'transcribing' ? '正在转写' : phase === 'analyzing' ? '正在提交' : phase === 'loading' ? '正在打开面试间' : '可以开始回答'

  return (
    <section className="campus-room">
      <div className="campus-progress">
        <span>第 {Math.min(questionIndex + 1, total)} 题 / 共 {total} 题</span>
        <strong>{progress}%</strong>
        <i style={{ width: `${progress}%` }} />
      </div>
      {error && <div className="campus-error">{error}</div>}
      <div className="campus-room-grid">
        <div className="campus-stage-card">
          <div className="campus-stage-video">
            <video ref={videoRef} autoPlay muted playsInline />
            {!videoOn && <div className="campus-video-off">摄像头关闭</div>}
            {phase === 'recording' && <div className="campus-rec">REC {formatClock(seconds)}</div>}
            {phase === 'speaking' && <div className="campus-speaking">面试官正在说话</div>}
          </div>
          <div className="campus-device-row">
            <button type="button" aria-pressed={videoOn} onClick={() => toggleTrack('video')}>{videoOn ? '关闭摄像头' : '打开摄像头'}</button>
            <button type="button" aria-pressed={audioOn} onClick={() => toggleTrack('audio')}>{audioOn ? '关闭麦克风' : '打开麦克风'}</button>
            {phase === 'speaking' ? (
              <button type="button" onClick={() => window.speechSynthesis?.cancel()}>停止播报</button>
            ) : (
              <button type="button" onClick={() => announce(question)} disabled={!question || busy}>重听这题</button>
            )}
          </div>
        </div>
        <div className="campus-question-col">
          <InterviewerOrb speaking={phase === 'speaking'} amplitude={amplitude} />
          <article className="campus-question-card">
            <div className="campus-q-index">{questionIndex + 1}</div>
            <div>
              <span>{question?.type || 'behavioral'} · {question?.difficulty || 'interview'}</span>
              <h2>{question?.question || (phase === 'loading' ? '正在读取题目' : '这轮题目已经答完')}</h2>
            </div>
            {phase === 'recording' && (
              <div className="campus-rec-banner">
                <strong>正在录音</strong>
                <span>对着麦克风说。说完再点停止并提交。</span>
              </div>
            )}
            <canvas ref={canvasRef} className={phase === 'recording' ? 'campus-wave' : 'campus-wave is-hidden'} width="640" height="96" />
          </article>
          <p className="campus-room-status" data-state={phase}>{status}</p>
          {typing ? (
            <form className="campus-room-actions" onSubmit={(event) => { event.preventDefault(); submitTranscript(transcript, 0) }}>
              <textarea value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="在这里打字回答" disabled={busy} />
              <div>
                <button type="button" onClick={() => setTyping(false)} disabled={busy}>改用麦克风</button>
                <button className="primary" type="submit" disabled={busy || !transcript.trim()}>{busy ? '正在提交' : '提交回答'}</button>
              </div>
            </form>
          ) : phase === 'recording' ? (
            <button className="danger" type="button" onClick={stopRecording} disabled={busy}>停止并提交</button>
          ) : (
            <div className="campus-room-actions">
              <button type="button" onClick={() => setTyping(true)} disabled={busy || phase === 'speaking' || !question}>打字回答</button>
              <button className="primary" type="button" onClick={startRecording} disabled={busy || phase === 'speaking' || !question}>
                {phase === 'speaking' ? '等题目说完' : '开始录音'}
              </button>
            </div>
          )}
          <p className="campus-room-hint">面试中不显示分数。答完后看总评和每题反馈。</p>
          {(item?.answers || []).length > 0 && phase !== 'summary' && (
            <button type="button" onClick={() => finish(item).catch((err) => { setPhase('idle'); setError(errorText(err)) })} disabled={busy}>提前结束并看总评</button>
          )}
        </div>
      </div>
    </section>
  )
}

function archiveTitle(row) {
  return row?.title?.trim() || row?.jobRole || '未命名面试'
}

function archiveStatus(status) {
  if (status === 'completed') return '已完成'
  if (status === 'abandoned') return '已放弃'
  return '未完成'
}

function archiveTime(row) {
  const value = row?.completedAt || row?.createdAt
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function ArchiveEditor({ row, onSaved, onCancel }) {
  const [name, setName] = useState(archiveTitle(row))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function save(event) {
    event.preventDefault()
    const title = name.trim()
    if (!title) {
      setError('名字不能为空。')
      return
    }
    setBusy(true)
    setError('')
    try {
      await campusFetch(`/api/interview/${row._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title }),
      })
      onSaved(title)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  return (
    <form className="campus-archive-edit" onSubmit={save}>
      <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} aria-label="档案名字" />
      <button className="primary" type="submit" disabled={busy}>保存</button>
      <button type="button" onClick={onCancel} disabled={busy}>取消</button>
      {error && <p className="campus-error">{error}</p>}
    </form>
  )
}

export function HistoryPage() {
  const { error, setError } = useStatus()
  const [rows, setRows] = useState([])
  const [editing, setEditing] = useState('')
  const [pendingDelete, setPendingDelete] = useState('')
  useEffect(() => {
    campusFetch('/api/interview/history')
      .then((payload) => setRows(payload.data || []))
      .catch((err) => setError(errorText(err)))
  }, [])

  async function remove(id) {
    setError('')
    try {
      await campusFetch(`/api/interview/${id}`, { method: 'DELETE' })
      setRows((current) => current.filter((row) => row._id !== id))
      setPendingDelete('')
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <section>
      <h1>历史档案</h1>
      <p>每场面试一份档案。可以重命名，也可以删除。删除后不能恢复。</p>
      {error && <div className="campus-error">{error}</div>}
      <ul className="campus-archives">
        {rows.map((row) => (
          <li className="campus-archive" key={row._id}>
            {editing === row._id ? (
              <ArchiveEditor
                row={row}
                onCancel={() => setEditing('')}
                onSaved={(title) => {
                  setRows((current) => current.map((item) => item._id === row._id ? { ...item, title } : item))
                  setEditing('')
                }}
              />
            ) : (
              <>
                <div>
                  <strong>{archiveTitle(row)}</strong>
                  <p>
                    {archiveStatus(row.status)}
                    {archiveTime(row) ? ` · ${archiveTime(row)}` : ''}
                    {row.status === 'completed' && Number.isFinite(row.overallScore) ? ` · ${row.overallScore}分` : ''}
                    {` · 已答 ${row.answeredCount || 0}/${row.totalQuestionCount || row.answeredCount || 0} 题`}
                  </p>
                </div>
                <div className="campus-archive-actions">
                  <Link to={`/history/${row._id}`}>查看</Link>
                  <button type="button" onClick={() => { setEditing(row._id); setPendingDelete('') }}>重命名</button>
                  {pendingDelete === row._id ? (
                    <>
                      <button type="button" className="danger" onClick={() => remove(row._id)}>确认删除</button>
                      <button type="button" onClick={() => setPendingDelete('')}>取消</button>
                    </>
                  ) : (
                    <button type="button" className="danger" onClick={() => setPendingDelete(row._id)}>删除</button>
                  )}
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {!error && rows.length === 0 && <p>还没有面试档案。</p>}
    </section>
  )
}

export function HistoryDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { error, setError } = useStatus()
  const [item, setItem] = useState(null)
  const [editing, setEditing] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(false)
  useEffect(() => {
    campusFetch(`/api/interview/${id}`)
      .then((payload) => setItem(payload.data))
      .catch((err) => setError(errorText(err)))
  }, [id])

  async function remove() {
    try {
      await campusFetch(`/api/interview/${id}`, { method: 'DELETE' })
      navigate('/history')
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <section className="campus-form">
      {error && <div className="campus-error">{error}</div>}
      {item && (
        <>
          {editing ? (
            <ArchiveEditor
              row={{ ...item, _id: id }}
              onCancel={() => setEditing(false)}
              onSaved={(title) => {
                setItem((current) => ({ ...current, title }))
                setEditing(false)
              }}
            />
          ) : (
            <>
              <h1>{archiveTitle(item)}</h1>
              <p>{archiveStatus(item.status)}{archiveTime(item) ? ` · ${archiveTime(item)}` : ''}{item.status === 'completed' && Number.isFinite(item.overallScore) ? ` · ${item.overallScore}分` : ''}</p>
              <div className="campus-archive-actions">
                <button type="button" onClick={() => setEditing(true)}>重命名</button>
                {pendingDelete ? (
                  <>
                    <button type="button" className="danger" onClick={remove}>确认删除</button>
                    <button type="button" onClick={() => setPendingDelete(false)}>取消</button>
                  </>
                ) : (
                  <button type="button" className="danger" onClick={() => setPendingDelete(true)}>删除</button>
                )}
                <Link to="/history">返回列表</Link>
              </div>
            </>
          )}
          <OverallView score={item.overallScore} feedback={item.overallFeedback} />
          {(item.answers || []).map((answer, index) => (
            <article className="campus-turn" key={answer.questionId || index}>
              <h2>第 {index + 1} 题</h2>
              <p><strong>问题：</strong>{answer.question}</p>
              <p><strong>你的回答：</strong>{answer.transcript || '没有保存回答文本。'}</p>
              <FeedbackView analysis={answer.analysis} />
            </article>
          ))}
        </>
      )}
    </section>
  )
}

export function ProfilePage() {
  const { error, setError, note, setNote } = useStatus()
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [skills, setSkills] = useState('')
  const [location, setLocation] = useState('')
  const [studyStage, setStudyStage] = useState('大一')

  useEffect(() => {
    campusFetch('/api/user-profiles/me')
      .then((payload) => {
        const profile = payload.profile || {}
        setDisplayName(profile.displayName || '')
        setBio(profile.bio || '')
        setSkills((profile.skills || []).join('，'))
        setLocation(profile.location || '')
        if (STUDY_STAGES.includes(profile.studyStage)) setStudyStage(profile.studyStage)
        else setStudyStage(profile.collegeStudent === false ? '已毕业' : '大一')
      })
      .catch((err) => setError(errorText(err)))
  }, [setError])

  async function save(event) {
    event.preventDefault()
    setError('')
    try {
      await campusFetch('/api/user-profiles/me', {
        method: 'PUT',
        body: JSON.stringify({
          displayName,
          bio,
          location,
          studyStage,
          skills: skills.split(/[，,]/).map((item) => item.trim()).filter(Boolean),
        }),
      })
      setNote('档案已保存。')
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <section>
      <h1>我的档案</h1>
      {error && <div className="campus-error">{error}</div>}
      {note && <div className="campus-note">{note}</div>}
      <form className="campus-form" onSubmit={save}>
        <label>姓名<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} /></label>
        <label>所在地<input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
        <label>技能，用逗号分隔<input value={skills} onChange={(event) => setSkills(event.target.value)} /></label>
        <label>简介<textarea value={bio} onChange={(event) => setBio(event.target.value)} /></label>
        <fieldset className="campus-stage">
          <legend>年级</legend>
          <div>
            {STUDY_STAGES.map((stage) => (
              <button
                key={stage}
                type="button"
                className={studyStage === stage ? 'primary' : ''}
                aria-pressed={studyStage === stage}
                onClick={() => setStudyStage(stage)}
              >
                {stage}
              </button>
            ))}
          </div>
        </fieldset>
        <button className="primary" type="submit">保存档案</button>
      </form>
    </section>
  )
}

export function ClosedPage() {
  return (
    <section>
      <h1>本阶段未开放</h1>
      <p>作品集、社区、支付、爬虫和编程题入口已关闭。请从首页的四个入口继续。</p>
      <Link to="/">返回首页</Link>
    </section>
  )
}
