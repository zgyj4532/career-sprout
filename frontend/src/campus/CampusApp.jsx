import { NavLink, Route, Routes, BrowserRouter, useLocation, Link } from 'react-router-dom'
import './campus.css'
import Particles from './bits/Particles'
import { CORE_NAV } from './nav'
import {
  ClosedPage,
  HistoryDetailPage,
  HistoryPage,
  HomePage,
  InterviewPage,
  InterviewSessionPage,
  JdPage,
  ProfilePage,
  ResumePage,
} from './pages'

function devNote() {
  const campus = import.meta.env.VITE_APP_PROFILE === 'campus-local'
  const bypass = import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
  const clerk = Boolean(import.meta.env.VITE_CLERK_PUBLISHABLE_KEY)
  if (!campus) return null
  if (clerk) return '已检测到 Clerk 公钥。本地开发身份不会覆盖正式登录。'
  if (import.meta.env.DEV && bypass) return '本地开发身份，只在本机有效。'
  return '未配置 Clerk，也未打开本地开发身份。'
}

function CoreNav() {
  return (
    <nav className="campus-core-nav" aria-label="主导航">
      {CORE_NAV.map(({ to, label, Icon }) => (
        <NavLink key={to} to={to} className={({ isActive }) => `campus-nav-item${isActive ? ' is-active' : ''}`}>
          <span className="campus-nav-icon"><Icon /></span>
          <span className="campus-nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function WorkspaceRoutes() {
  return (
    <Routes>
      <Route path="/resume" element={<ResumePage />} />
      <Route path="/interview" element={<InterviewPage />} />
      <Route path="/jd" element={<JdPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/history/:id" element={<HistoryDetailPage />} />
      <Route path="*" element={<ClosedPage />} />
    </Routes>
  )
}

function CampusShell() {
  const { pathname } = useLocation()
  const room = pathname.startsWith('/interview/session/')
  const note = devNote()

  if (room) {
    return (
      <div className="campus campus-immersive">
        <header className="campus-room-bar">
          <Link to="/interview">退出面试间</Link>
        </header>
        <main className="campus-room-main">
          <Routes>
            <Route path="/interview/session/:id" element={<InterviewSessionPage />} />
          </Routes>
        </main>
      </div>
    )
  }

  if (pathname === '/') {
    return (
      <div className="campus campus-portal">
        <div className="campus-portal-particles" aria-hidden="true">
          <Particles
            particleColors={['#136c53', '#8c7a6b', '#d9d0c3']}
            particleCount={45}
            speed={0.08}
            moveParticlesOnHover
            alphaParticles
          />
        </div>
        <header className="campus-portal-header">
          <Link className="campus-brand" to="/">校园职业练习</Link>
          <div className="campus-portal-actions">
            {note && <span className="campus-dev-note">{note}</span>}
            <Link className="campus-pill-link" to="/history">历史档案</Link>
          </div>
        </header>
        <main className="campus-portal-main">
          <HomePage />
        </main>
      </div>
    )
  }

  return (
    <div className="campus campus-workspace">
      <aside className="campus-nav-container">
        <div className="campus-sidebar-top">
          <Link className="campus-brand-back" to="/">
            <span className="campus-brand">校园职业练习</span>
            <span className="campus-back-badge">回首页</span>
          </Link>
        </div>
        <CoreNav />
        <div className="campus-sidebar-footer">
          <NavLink to="/history" className={({ isActive }) => `campus-nav-item is-secondary${isActive ? ' is-active' : ''}`}>
            <span className="campus-nav-label">历史档案</span>
          </NavLink>
          {note && <p className="campus-dev-note">{note}</p>}
        </div>
      </aside>
      <div className="campus-workspace-content">
        <header className="campus-mobile-topbar">
          <Link className="campus-brand" to="/">校园职业练习</Link>
          <Link className="campus-pill-link" to="/history">历史档案</Link>
        </header>
        <main className="campus-main">
          <WorkspaceRoutes />
        </main>
      </div>
    </div>
  )
}

export default function CampusApp() {
  return (
    <BrowserRouter>
      <CampusShell />
    </BrowserRouter>
  )
}
