import { lazy, useEffect, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, createBrowserRouter, RouterProvider, useLocation, Link } from 'react-router-dom'
import './campus.css'
import Particles from './bits/Particles'
import { CORE_NAV } from './nav'
import HomePage from './pages/HomePage'
import RouteLoadingBoundary from './components/RouteLoadingBoundary'
import { CampusSessionProvider, SessionNavigation, useCampusSession } from './auth'
import UnsavedWorkProvider from './components/UnsavedWorkProvider'
import RequestError from './components/RequestError'
import CampusClerkProvider from './CampusClerkProvider'

const ResumePage = lazy(() => import('./pages/ResumePage'))
const JobsPage = lazy(() => import('./pages/JobsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const InterviewPage = lazy(() => import('./pages/InterviewPage'))
const DiscoveryPage = lazy(() => import('./pages/DiscoveryPage'))
const InterviewSessionPage = lazy(() => import('./pages/InterviewSessionPage'))
const HistoryPage = lazy(() => import('./pages/HistoryPage').then(module => ({ default: module.HistoryPage })))
const HistoryDetailPage = lazy(() => import('./pages/HistoryPage').then(module => ({ default: module.HistoryDetailPage })))
const AuthPage = lazy(() => import('./pages/AuthPage'))
const TeacherPage = lazy(() => import('./pages/TeacherPage'))
const ClosedPage = lazy(() => import('./pages/ClosedPage'))

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

function WorkspaceMenu() {
  const heading = useRef(null)
  const note = devNote()
  useEffect(() => { heading.current?.focus() }, [])

  return (
    <section className="campus-workspace-menu campus-form" aria-labelledby="workspace-menu-heading">
      <h1 id="workspace-menu-heading" ref={heading} tabIndex={-1}>工作台菜单</h1>
      <div className="campus-panel">
        {[['/', '回首页'], ['/history', '历史档案']].map(([to, label]) => (
          <Link className="campus-workspace-menu-row" key={to} to={to}>
            {label}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true" focusable="false"><path d="m6 3 5 5-5 5" /></svg>
          </Link>
        ))}
        <section className="campus-form campus-workspace-menu-account" aria-labelledby="workspace-account-heading">
          <h2 id="workspace-account-heading">账号</h2>
          <SessionNavigation />
          {note && <p className="campus-dev-note">{note}</p>}
        </section>
      </div>
    </section>
  )
}

function WorkspaceRoutes() {
  return (
    <Routes>
      <Route path="/resume" element={<ResumePage />} />
      <Route path="/interview" element={<InterviewPage />} />
      <Route path="/discovery" element={<DiscoveryPage />} />
      <Route path="/jd" element={<JobsPage />} />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/workspace-menu" element={<WorkspaceMenu />} />
      <Route path="/history" element={<HistoryPage />} />
      <Route path="/history/:id" element={<HistoryDetailPage />} />
      <Route path="/login/*" element={<AuthPage />} />
      <Route path="/register/*" element={<AuthPage />} />
      <Route path="/verify-email/*" element={<AuthPage />} />
      <Route path="/teacher" element={<TeacherPage />} />
      <Route path="*" element={<ClosedPage />} />
    </Routes>
  )
}

function CampusShell() {
  const { pathname } = useLocation()
  const { status, error, loadingStage, pendingSession, refresh } = useCampusSession()
  const room = pathname.startsWith('/interview/session/')
  const note = devNote()

  if (room) {
    return (
      <div className="campus campus-practice">
        <header className="campus-room-bar">
          <Link to="/interview">退出练习</Link>
        </header>
        <main className="campus-room-main">
          <RouteLoadingBoundary>
            <Routes>
              <Route path="/interview/session/:id" element={<InterviewSessionPage />} />
            </Routes>
          </RouteLoadingBoundary>
        </main>
      </div>
    )
  }

  if (pathname === '/') {
    if (pendingSession || (status && !status.authenticated)) return <Navigate to="/login" replace />
    if (!status || error || loadingStage) return (
      <main className="campus campus-auth">
        <section className="campus-auth-card campus-form" aria-label="账号状态">
          <h1>正在进入职芽</h1>
          <RequestError error={error} onRetry={refresh} />
          {!error && <p role="status">{loadingStage === 'clerk' ? '正在连接安全登录服务…' : '正在确认账号服务状态…'}</p>}
          <Link to="/login">前往登录与账号恢复</Link>
        </section>
      </main>
    )
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
          <Link className="campus-brand" to="/">职芽 <small>CareerSprout</small></Link>
          <div className="campus-portal-actions">
            {note && <span className="campus-dev-note">{note}</span>}
            <Link className="campus-pill-link" to="/history">历史档案</Link>
            <SessionNavigation />
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
            <span className="campus-brand">职芽 <small>CareerSprout</small></span>
            <span className="campus-back-badge">回首页</span>
          </Link>
        </div>
        <CoreNav />
        <div className="campus-sidebar-footer">
          <NavLink to="/history" className={({ isActive }) => `campus-nav-item is-secondary${isActive ? ' is-active' : ''}`}>
            <span className="campus-nav-label">历史档案</span>
          </NavLink>
          {note && <p className="campus-dev-note">{note}</p>}
          <SessionNavigation />
        </div>
      </aside>
      <div className="campus-workspace-content">
        <main className="campus-main">
          <RouteLoadingBoundary>
            <WorkspaceRoutes />
          </RouteLoadingBoundary>
        </main>
      </div>
    </div>
  )
}

export default function CampusApp() {
  const [router] = useState(() => createBrowserRouter([{
    path: '*',
    element: <CampusClerkProvider><CampusSessionProvider><UnsavedWorkProvider><CampusShell /></UnsavedWorkProvider></CampusSessionProvider></CampusClerkProvider>,
  }], { basename: import.meta.env.BASE_URL }))
  return <RouterProvider router={router} />
}
