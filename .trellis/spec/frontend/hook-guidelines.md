# Hook Guidelines

## Lifecycle ownership

`hooks/useAudioCapture.js` owns MediaRecorder, MediaStream tracks and timer cleanup. `hooks/useQuestionSpeech.js` owns speech playback. Do not couple waveform rendering or speech playback to capture ownership.

Use state for rendered values and refs for mutable async ownership. `useAudioCapture` keeps `{generation,state,stream,recorder,timer,mounted}` in a ref. A generation is incremented on cancellation/unmount; a late permission result stops its tracks rather than starting a recording.

```js
const generation = ++owner.current.generation
const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
if (!owner.current.mounted || generation !== owner.current.generation) {
  stream.getTracks().forEach(track => track.stop())
  return
}
```

The recording indicator starts on MediaRecorder `onstart`, not on button click or permission request. Stop/cancel/unmount remove callbacks, stop tracks and clear timers. Default camera remains off. Capture limits and upload limits both apply; server limits remain authoritative.

## Effects and requests

Effects that acquire resources return cleanup. Support React development StrictMode mount/cleanup behavior. Stable callbacks include real dependencies; do not suppress stale-closure warnings. `campusFetch` accepts AbortSignal and composes cancellation with its own timeout. Generation/revision checks are still needed to prevent older responses applying after a user edit.

Behavior regressions belong under `hooks/__tests__/`: permission resolves after cancel/unmount, repeat start is single-flight, actual start/stop transitions, and track release. Mock media only to exercise these branches; it does not prove human microphone quality.
