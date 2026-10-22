import { Component, lazy, Suspense, useEffect, useRef, useState } from 'react'

const BlurText = lazy(() => import('../bits/BlurText'))
const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

// An optional animation must never replace the phrase or disable its toggle.
class SloganAnimationBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

const phrases = ['从现在开始，让每一次练习长成未来。', '咱平时啊，在学校咱们就练起来']
export default function Slogan() {
  const [alternate, setAlternate] = useState(false)
  const [replay, setReplay] = useState(false)
  const [fading, setFading] = useState(false)
  const [reduced, setReduced] = useState(() => window.matchMedia?.(reducedMotionQuery).matches ?? false)
  const locked = useRef(false)
  const timers = useRef({ phrase: null, unlock: null })
  useEffect(() => {
    const media = window.matchMedia?.(reducedMotionQuery)
    if (!media) return undefined
    setReduced(media.matches)
    const update = (event) => setReduced(event.matches)
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])
  useEffect(() => () => { clearTimeout(timers.current.phrase); clearTimeout(timers.current.unlock) }, [])
  function toggle() {
    if (locked.current) return
    if (reduced) { setAlternate((value) => !value); return }
    locked.current = true
    setFading(true)
    timers.current.phrase = setTimeout(() => { timers.current.phrase = null; setAlternate((value) => !value); setReplay(true); setFading(false) }, 100)
    timers.current.unlock = setTimeout(() => { timers.current.unlock = null; locked.current = false }, 650)
  }
  const phrase = phrases[Number(alternate)]
  return <div>
    <h1 className="campus-slogan-heading"><button className={`campus-slogan-toggle${fading ? ' is-fading' : ''}`} type="button" aria-pressed={alternate} aria-label={phrases[Number(alternate)]} onClick={toggle}>
      <span className="campus-slogan-measure" aria-hidden="true">{phrases[0]}</span>
      <span className="campus-slogan-measure" aria-hidden="true">{phrases[1]}</span>
      <span className="campus-slogan-display" aria-hidden="true">
        <SloganAnimationBoundary fallback={phrase}>
          <Suspense fallback={phrase}>
            {replay && !reduced ? <BlurText key={String(alternate)} as="span" text={phrase} animateBy="chars" delay={7} stepDuration={0.18} animationFrom={{ opacity: 0, filter: 'blur(5px)', y: 5 }} animationTo={[{ opacity: 0.6, filter: 'blur(2px)', y: 2 }, { opacity: 1, filter: 'blur(0px)', y: 0 }]} /> : phrase}
          </Suspense>
        </SloganAnimationBoundary>
      </span>
    </button></h1>
  </div>
}
