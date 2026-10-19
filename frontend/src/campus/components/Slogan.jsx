import { useEffect, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import BlurText from '../bits/BlurText'

const phrases = ['从现在开始，让每一次练习长成未来。', '咱平时啊，在学校咱们就练起来']
export default function Slogan() {
  const [alternate, setAlternate] = useState(false)
  const [replay, setReplay] = useState(false)
  const [fading, setFading] = useState(false)
  const reduced = useReducedMotion()
  const locked = useRef(false)
  const timers = useRef({ phrase: null, unlock: null })
  useEffect(() => () => { clearTimeout(timers.current.phrase); clearTimeout(timers.current.unlock) }, [])
  function toggle() {
    if (locked.current) return
    if (reduced) { setAlternate((value) => !value); return }
    locked.current = true
    setFading(true)
    timers.current.phrase = setTimeout(() => { timers.current.phrase = null; setAlternate((value) => !value); setReplay(true); setFading(false) }, 100)
    timers.current.unlock = setTimeout(() => { timers.current.unlock = null; locked.current = false }, 650)
  }
  return <div>
    <h1 className="campus-slogan-heading"><button className={`campus-slogan-toggle${fading ? ' is-fading' : ''}`} type="button" aria-pressed={alternate} aria-label={phrases[Number(alternate)]} onClick={toggle}>
      <span className="campus-slogan-measure" aria-hidden="true">{phrases[0]}</span>
      <span className="campus-slogan-measure" aria-hidden="true">{phrases[1]}</span>
      <span className="campus-slogan-display" aria-hidden="true">{replay && !reduced ? <BlurText key={String(alternate)} as="span" text={phrases[Number(alternate)]} animateBy="chars" delay={7} stepDuration={0.18} animationFrom={{ opacity: 0, filter: 'blur(5px)', y: 5 }} animationTo={[{ opacity: 0.6, filter: 'blur(2px)', y: 2 }, { opacity: 1, filter: 'blur(0px)', y: 0 }]} /> : phrases[Number(alternate)]}</span>
    </button></h1>
    <p className="campus-slogan-hint">点一下，换句话说</p>
  </div>
}
