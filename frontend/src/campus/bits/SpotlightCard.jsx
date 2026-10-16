import { useRef } from 'react'

export default function SpotlightCard({ className = '', spotlightColor = 'rgba(19, 108, 83, 0.08)', children }) {
  const ref = useRef(null)

  function move(event) {
    const card = ref.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    card.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    card.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
  }

  return (
    <div
      ref={ref}
      className={`campus-spotlight ${className}`.trim()}
      style={{ '--spot': spotlightColor }}
      onMouseMove={move}
    >
      {children}
    </div>
  )
}
