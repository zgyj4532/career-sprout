import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'

const buildKeyframes = (from, steps) => {
  const keys = new Set([...Object.keys(from), ...steps.flatMap((step) => Object.keys(step))])
  const keyframes = {}
  keys.forEach((key) => {
    keyframes[key] = [from[key], ...steps.map((step) => step[key])]
  })
  return keyframes
}

export default function BlurText({
  text = '',
  delay = 80,
  className = '',
  animateBy = 'words',
  direction = 'top',
  threshold = 0.1,
  rootMargin = '0px',
  animationFrom,
  animationTo,
  easing = (value) => value,
  onAnimationComplete,
  stepDuration = 0.35,
  as: Tag = 'p',
}) {
  const elements = animateBy === 'words' ? text.split(' ') : Array.from(text)
  const [inView, setInView] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return undefined
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          observer.disconnect()
        }
      },
      { threshold, rootMargin },
    )
    observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold, rootMargin])

  const defaultFrom = useMemo(
    () => (direction === 'top'
      ? { filter: 'blur(10px)', opacity: 0, y: -24 }
      : { filter: 'blur(10px)', opacity: 0, y: 24 }),
    [direction],
  )
  const defaultTo = useMemo(
    () => [
      { filter: 'blur(5px)', opacity: 0.5, y: direction === 'top' ? 4 : -4 },
      { filter: 'blur(0px)', opacity: 1, y: 0 },
    ],
    [direction],
  )
  const fromSnapshot = animationFrom ?? defaultFrom
  const toSnapshots = animationTo ?? defaultTo
  const stepCount = toSnapshots.length + 1
  const totalDuration = stepDuration * (stepCount - 1)
  const times = Array.from({ length: stepCount }, (_, index) => (stepCount === 1 ? 0 : index / (stepCount - 1)))

  return (
    <Tag ref={ref} className={className}>
      {elements.map((segment, index) => (
        <motion.span
          className="campus-blur-char"
          key={`${segment}-${index}`}
          initial={fromSnapshot}
          animate={inView ? buildKeyframes(fromSnapshot, toSnapshots) : fromSnapshot}
          transition={{
            duration: totalDuration,
            times,
            delay: (index * delay) / 1000,
            ease: easing,
          }}
          onAnimationComplete={index === elements.length - 1 ? onAnimationComplete : undefined}
        >
          {segment}
        </motion.span>
      ))}
    </Tag>
  )
}
