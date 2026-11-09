import { useCallback } from 'react'
import { ClerkProvider } from '@clerk/react'
import { useNavigate } from 'react-router-dom'
import { clerkLocalization } from './clerkLocalization'

export default function CampusClerkProvider({ children }) {
  const navigate = useNavigate()
  const basename = import.meta.env.BASE_URL.replace(/\/$/, '')
  const navigateClerk = useCallback((to, replace, metadata) => {
    const destination = new URL(to, window.location.href)
    const insideApp = destination.origin === window.location.origin && (
      !basename || destination.pathname === basename || destination.pathname.startsWith(`${basename}/`)
    )
    if (!insideApp) {
      // OAuth / Account Portal redirects must remain document navigations.
      if (metadata?.windowNavigate) return metadata.windowNavigate(to)
      return replace ? window.location.replace(to) : window.location.assign(to)
    }
    // Clerk uses document paths; React Router applies its basename itself.
    const pathname = destination.pathname.slice(basename.length) || '/'
    return navigate(`${pathname}${destination.search}${destination.hash}`, { replace })
  }, [basename, navigate])
  const routerPush = useCallback((to, metadata) => navigateClerk(to, false, metadata), [navigateClerk])
  const routerReplace = useCallback((to, metadata) => navigateClerk(to, true, metadata), [navigateClerk])
  const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
  const registrationEnabled = import.meta.env.DEV || import.meta.env.VITE_CLERK_SIGN_UP_ENABLED === 'true'

  // Missing-key and explicit local development identity remain provider-free.
  if (!publishableKey) return children
  return <ClerkProvider
    publishableKey={publishableKey}
    localization={clerkLocalization}
    signInUrl={`${basename}/login`}
    signUpUrl={`${basename}/${registrationEnabled ? 'register' : 'login'}`}
    afterSignOutUrl={import.meta.env.BASE_URL}
    routerPush={routerPush}
    routerReplace={routerReplace}
  >{children}</ClerkProvider>
}
