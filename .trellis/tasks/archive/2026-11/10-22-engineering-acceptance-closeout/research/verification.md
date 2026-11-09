# Engineering closeout verification

## Actual runs and corrections
- First unified run: doctor PASS,19 script tests PASS, backend campus115/116 (one failing deletion admission test), shared148 PASS, frontend166/28files PASS, campus lint0errors (backend11/frontend20warnings), build PASS. Smoke correctly NOT_RUN because required backend gate failed. Original run report retained under docs/evidence/phase1/runs/.
- Deletion test called deleteResumeOwned before async account admission, then expected synchronous per-resume lock ordering. Updated fixture to enter existing withAccountWrite first, as HTTP handler does. All cleanup/late-writer/interview-preservation assertions retained; no production behavior modified. Focused resumeSafety8/8 PASS.
- First standalone smoke: Host probe failed because fetch did not transmit the intended foreign Host. Replaced this probe with node:http literal Host, with wire-level regression. Retained failure report smoke.json. Corrected real API create/edit/read + owned stop/restart/persistence smoke PASS in smoke-final.json; all cleanup PASS.
- Actual SIGTERM after owned backend start: smoke exit143/statusFAIL, cleanup backend/database/files allPASS. This is expected cancellation, not successful business acceptance. Evidence interrupted-smoke.json. Temporary harness removed.
- Running npm-cli via Node24 without adjusting PATH correctly rejected the npm script's different Node runtime: all gates NOT_RUN and BLOCKED_EXTERNAL exit2. Documented nvm use / pinned PATH fixes entry runtime; not suppressed or treated as pass.

## Browser
See browser-verification.md and browser-2026-10-23.json:8 current page/viewport cases at360/768, actual save failure/recovery; synthetic layout data only. Earlier390/1440 evidence remains historical. Formal Clerk credentials still absent; real dual accounts, new-host deployment, novices and physical-device acceptance remain external.

## Safety and scope
No dormant module deletion/dependency removal, no public deployment, no paid/model/ASR calls, no commits/push/archive. All original developer data retained. Existing lint warnings and Mongoose deprecation warnings remain visible; no warning suppression. Lock checks prove structural declarations, not a fresh npm ci.

Final unified rerun: `npm run verify:phase1` with Node24 bin prepended to PATH, exit0. All9 engineering gates PASS: doctor,20 local-script tests,116 backend campus tests,148 shared tests, backend/frontend scoped lint (0errors,11/20warnings),166 frontend tests in28files, campus build, isolated API/restart/persistence. Run ID `2026-10-23T16-14-46-510Z-ee3fc51f`; report `docs/evidence/phase1/runs/2026-10-23T16-14-46-510Z-ee3fc51f/verify-phase1.json`, smoke same directory. Node24.14.1/npm11.11.0; selected PATH Python3.14.7 (earlier direct WSL run selected3.12.3); no interpreter installation/change. Full acceptance remains false. Optional upstream suite and PDF export were not run this round.
