import { Component, Suspense } from 'react'
import { Link, useLocation } from 'react-router-dom'

class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false, navigationKey: props.navigationKey }
  }

  static getDerivedStateFromProps(props, state) {
    if (props.navigationKey !== state.navigationKey) {
      return { failed: false, navigationKey: props.navigationKey }
    }
    return null
  }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (this.state.failed) {
      return (
        <section className="campus-route-state" aria-label="页面加载失败">
          <div role="alert">
            <h1>页面未能打开</h1>
            <p>页面加载失败，请检查网络后刷新，或先返回首页。</p>
          </div>
          <p id="campus-route-refresh-warning">刷新会丢失未保存的内容，请先确认其他编辑已保存。</p>
          <div className="campus-route-actions">
            <Link className="button" to="/">返回首页</Link>
            <button type="button" aria-describedby="campus-route-refresh-warning" onClick={() => window.location.reload()}>刷新页面</button>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}

export default function RouteLoadingBoundary({ children }) {
  const location = useLocation()
  return (
    <RouteErrorBoundary navigationKey={location.key}>
      {/* A new pathname must show pending UI even during a router transition.
          Query changes and provider renders must retain the current editor. */}
      <Suspense key={location.pathname} fallback={<div className="campus-route-state" role="status">第一次打开需要时间，请耐心等待</div>}>
        {children}
      </Suspense>
    </RouteErrorBoundary>
  )
}
