import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { ClerkProvider } from '@clerk/clerk-react'
import { registerSW } from 'virtual:pwa-register'

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
          <pre>{this.state.error.stack || this.state.error.message}</pre>
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
    <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
      {app}
    </ClerkProvider>
  )
}

if (import.meta.env.DEV && !PUBLISHABLE_KEY && !campusLocal) {
  console.warn('VITE_CLERK_PUBLISHABLE_KEY is missing; running in public-preview mode.')
}

const Page = campusLocal
  ? (await import('./campus/CampusApp.jsx')).default
  : (await import('./App.jsx')).default

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root Page={Page} />
  </React.StrictMode>,
)

if ('serviceWorker' in navigator && import.meta.env.PROD && !campusLocal) {
  registerSW({
    immediate: true,
    onOfflineReady() {},
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })
}
