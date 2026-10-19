import React from 'react'
import ReactDOM from 'react-dom/client'
import '@app-styles'
import { ClerkProvider } from '@clerk/clerk-react'
import { clerkLocalization } from './campus/clerkLocalization'
import Page from '@app-entry'

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
const campusLocal = import.meta.env.VITE_APP_PROFILE === 'campus-local'
const localBypass = campusLocal
  && import.meta.env.DEV
  && import.meta.env.VITE_DEV_BYPASS_AUTH === 'true'
  && !PUBLISHABLE_KEY

class DebugBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" style={{ minHeight: '100vh', padding: 24 }}>
          <h1>页面启动失败</h1>
          <p>请刷新重试。如果仍然失败，请联系维护者检查服务状态。</p>
        </div>
      )
    }
    return this.props.children
  }
}

function Root({ Page }) {
  const app = (
    <DebugBoundary>
      <Page />
    </DebugBoundary>
  )
  if (localBypass || !PUBLISHABLE_KEY) return app
  return (
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/" localization={campusLocal ? clerkLocalization : undefined}>
      {app}
    </ClerkProvider>
  )
}

if (import.meta.env.DEV && !PUBLISHABLE_KEY && !campusLocal) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY is missing; running in public-preview mode.')
}


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root Page={Page} />
  </React.StrictMode>,
)

