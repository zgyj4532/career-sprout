import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  registerSW({
    immediate: true,
    onOfflineReady() {},
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })
}

export default App
