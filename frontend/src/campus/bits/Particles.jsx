import { useEffect, useRef } from 'react'

export default function Particles({
  particleColors = ['#136c53', '#8c7a6b', '#d9d0c3'],
  particleCount = 45,
  speed = 0.08,
  moveParticlesOnHover = true,
  alphaParticles = true,
}) {
  const canvasRef = useRef(null)
  const palette = particleColors.join('|')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d')
    const colors = palette.split('|')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dust = Array.from({ length: particleCount }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: 0.7 + Math.random() * 1.4,
      drift: (Math.random() - 0.5) * speed,
      rise: 0.015 + Math.random() * speed,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: alphaParticles ? 0.28 + Math.random() * 0.4 : 0.7,
    }))
    const pointer = { x: 0.5, y: 0.5 }
    const onMove = (event) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = (event.clientX - rect.left) / rect.width
      pointer.y = (event.clientY - rect.top) / rect.height
    }
    if (moveParticlesOnHover) window.addEventListener('mousemove', onMove)

    let frame = 0
    const draw = () => {
      const rect = canvas.getBoundingClientRect()
      const ratio = window.devicePixelRatio || 1
      const width = Math.max(1, Math.floor(rect.width * ratio))
      const height = Math.max(1, Math.floor(rect.height * ratio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      context.clearRect(0, 0, rect.width, rect.height)
      for (const speck of dust) {
        if (!reduced) {
          speck.x += speck.drift * 0.12
          speck.y -= speck.rise * 0.12
          if (moveParticlesOnHover) {
            const dx = speck.x - pointer.x
            const dy = speck.y - pointer.y
            const distance = Math.hypot(dx, dy)
            if (distance < 0.14) {
              speck.x += dx * 0.015
              speck.y += dy * 0.015
            }
          }
          if (speck.y < -0.03) speck.y = 1.03
          if (speck.x < -0.03) speck.x = 1.03
          if (speck.x > 1.03) speck.x = -0.03
        }
        context.globalAlpha = speck.alpha
        context.fillStyle = speck.color
        context.beginPath()
        context.arc(speck.x * rect.width, speck.y * rect.height, speck.radius, 0, Math.PI * 2)
        context.fill()
      }
      context.globalAlpha = 1
      frame = requestAnimationFrame(draw)
    }
    draw()
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('mousemove', onMove)
    }
  }, [alphaParticles, moveParticlesOnHover, palette, particleCount, speed])

  return <canvas ref={canvasRef} className="campus-particle-canvas" />
}
