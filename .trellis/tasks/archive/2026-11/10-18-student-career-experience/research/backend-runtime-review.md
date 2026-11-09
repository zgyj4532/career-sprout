# Backend runtime/simplicity review — round 1

Read-only reviewer BackendRuntimeReview; no checks run. Seven actionable findings, all Status: open. Parent persisted report because reviewer is read-only.

1. **bug/P1 — ASR decoded-output and concurrency limits**, `backend/src/services/interviewService.js:590-597`: compressed10MiB upload can expand into unbounded WAV/MP3 reads/base64/JSON copies; concurrent transcribes retain multiple copies. Bound duration and output bytes during conversion and before reading; process-wide finite admission before upload buffering where possible.
2. **bug/P2 — Audio tempfile cleanup**, `interviewService.js:563-571`: write/path conversion before try/finally leaks audio directories on disk/wslpath failures. Enclose setup immediately after mkdtemp in cleanup scope.
3. **bug/P1 — PDF input cap before parsers**, `services/pdfGenerator.js:80-81`: marked/Cheerio run before200KB limit and before global gate; oversized legacy resumes allocate first. Check raw input bound before parse/sanitize; keep post-sanitize bound.
4. **bug/P2 — ID-resolved interview context bound**, `routes/interview.js:106-114`: server-resolved originalText bypasses20,000char validation. Revalidate resolved values; do not silently truncate user facts.
5. **bug/P2 — Useful sanitized database failure cause**, `config/database.js:9-11`: constant error loses auth/DNS/refused/timeout distinction. Preserve allowlisted class/code via safeErrorMetadata, no raw message/URI.
6. **bug/P1 — Client cancellation propagated to ASR**, `routes/interview.js:240-249`: browser abort leaves ffmpeg/provider requests and buffers alive. Request-scoped signal through service/provider/spawn, finally cleanup; don't release global admission while work still actually running.
7. **bug/P2 — Safe provider network failure cause**, `config/providers/openrouter.js:80`: only error.status logged, absent on common ECONNRESET/ETIMEDOUT/ENOTFOUND paths. Log allowlisted code/class, no raw upstream payload/prompt.

Overall: incorrect until these observable resource/cancellation/diagnostic defects are addressed. Re-review exact fixes plus focused behavior regressions; do not claim rendered PDF or real microphone proof from static review.
