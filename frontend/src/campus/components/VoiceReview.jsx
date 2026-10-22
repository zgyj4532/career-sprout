import { useEffect, useState } from 'react'
import VoiceInput from './VoiceInput'

export default function VoiceReview({ onReview, onActiveChange, disabled = false }) {
  const [review, setReview] = useState(null)
  const [seconds, setSeconds] = useState(0)
  const [active, setActive] = useState(false)
  useEffect(() => { onActiveChange?.(active || review !== null); return () => onActiveChange?.(false) }, [active, review, onActiveChange])
  return <div className="campus-form">
    <VoiceInput disabled={disabled} onActiveChange={setActive} onTranscript={(text, duration) => { setReview((current) => [current, text].filter(Boolean).join('\n')); setSeconds((current) => current + duration) }} />
    {review !== null && <><label>转写校对<textarea value={review} onChange={(event) => setReview(event.target.value)} /></label><div className="campus-actions"><button type="button" disabled={disabled || active || !review.trim()} onClick={() => { onReview(review, seconds); setReview(null); setSeconds(0) }}>使用校对后的文字</button><button type="button" disabled={active} onClick={() => { setReview(null); setSeconds(0) }}>放弃这段转写</button></div></>}
  </div>
}
