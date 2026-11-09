# Frontend implementation handoff

Status: implementation delivered; all execution checks below NOT_RUN in this edit-only slice. No installs, tests, lint, formatter, build, browser, service, commits, pushes or rename operations were run. Parent owns serial verification and memory monitoring.

## Files

Changed existing frontend files:
- `frontend/src/campus/CampusApp.jsx`: direct workflow imports, auth/teacher routes, real session navigation, 职芽 brand, preserved portal/sidebar/mobile shell; paper-style interview room.
- `frontend/src/campus/nav.js`: growth-oriented navigation, preserved existing artwork.
- `frontend/src/campus/api.js`: request IDs, bounded 200-event safe diagnostic ring, route-template redaction (including short Clerk UIDs), explicit JSON parse errors, PDF/ZIP Blob handling, cancellation/timeouts, safe human errors, diagnostic and file downloads.
- `frontend/src/campus/campus.css`: additive paper/green workflow styles, stable natural slogan footprint, visible recording banner, focus/touch/responsive/reduced-motion treatment. Existing user style edits retained.
- `frontend/src/main.jsx`: campus Clerk Chinese localization and non-stack fatal recovery message.
- `frontend/index.html`, `frontend/pwaOptions.js`, `frontend/vite.config.js`: actual Chinese language/title/description and CareerSprout identity. Existing loopback/proxy and removal of campus external font/payment scripts preserved.
- `frontend/package.json`, `frontend/package-lock.json`: root frontend package metadata only; no dependency changes/install.
- Removed `frontend/src/campus/pages.jsx` after migrating callers, with no re-export shim. Existing feedback/history implementations moved rather than discarded.

New workflow modules under `frontend/src/campus/`:
- `auth.jsx`, `clerkLocalization.js`, `material.js`.
- `pages/HomePage.jsx`, `ProfilePage.jsx`, `JobsPage.jsx`, `ResumePage.jsx`, `InterviewPage.jsx`, `InterviewSessionPage.jsx`, `HistoryPage.jsx`, `AuthPage.jsx`, `TeacherPage.jsx`, `ClosedPage.jsx`.
- `components/RequestError.jsx`, `Slogan.jsx`, `SharingControls.jsx`, `GapView.jsx`, `TargetResumes.jsx`, `VoiceInput.jsx`, `InterviewFeedback.jsx`, `JobSelect.jsx`.
- `hooks/useAudioCapture.js`, `hooks/useQuestionSpeech.js`.

## Implemented behavior and API contracts

- Home derives one next action from actual `/api/campus/me`, resume and interview history data. Existing resumes permit direct practice; target direction is optional. Examples are disclosure-only, never prefilled/saved personal facts. Slogan uses existing BlurText/motion with phrase-keyed explicit replay, stable button and measurement grid, ~650ms single-flight transition, exact alternate wording, reduced-motion immediate switch and no persistence.
- Profile loads `/api/campus/me`; saves canonical profile fields through existing `/api/user-profiles/me`, and private interests/experience evidence/skill levels/time through `PUT /api/campus/me`. Partial two-resource save is reported honestly. Sharing grants/revokes use `/teachers` and `/me/sharing`.
- Jobs use `/jobs` CRUD with backend `page`/`limit` pagination (maximum 50), `/jobs/analyze`, `/jobs/:id/gap`; AI requirements require adoption before save. Target selection persists through `PUT /me`. Job selectors can fetch further pages and retain selected deep-linked jobs outside the initial page.
- Resume text/profile/voice inputs feed the editable source. `POST /resumes/polish` returns compare/adopt/cancel suggestions; source revisions and request identity prevent stale application. Existing `/api/resumes` CRUD/save/reload/A4 download remain canonical; optional target is genuinely optional. Unsaved changes disable PDF/target generation so exported source is explicit.
- Target variants use `POST /me/resumes/:id/target`, `GET /me/targets`, `PATCH /me/targets/:id` and `POST /me/targets/:id/approve` with exact revision. Edit invalidates approval, conflicts preserve user edits. Backend agreed to use current `originalText`, not legacy `enhancedText`, for target and interview selected source.
- Teacher view requires server `isTeacher`, separates covered/conflict/unknown pools, shows levels/evidence and approved versions; `POST /teacher/jobs/:id/export` downloads actual ZIP, with explicit instruction to read partial-failure manifest. Max20 selected; no client elevation or fabricated account/candidates.
- Interview start passes owned `resumeId`/visible `jobId` when selected; custom unsaved material uses existing `resumeText`. Mode, Chinese language and real study stage are passed. Backend confirmed mode/persisted context support. Answers use existing multipart `questionId`, `transcript`, `duration`, `isWarmup`. GET canonical state is reconciled before submission and after ambiguous results/409; uncertain state prevents resubmission until reconciliation. Summary is a separate retryable operation. Session-id-keyed room ownership prevents old loads affecting a new session.
- One audio hook is used by both resume and interview. Audio only; camera not requested or represented as analyzed. State/timer become recording only on MediaRecorder `onstart`; 180s limit, 8MiB conservative stop and explicit >=10MiB rejection for final chunks; MIME-derived extension including mp4/m4a. Cancel/unmount/late permission stop tracks. No waveform dependency exists, so waveform failure cannot hide capture. Stop automatically starts ASR; editable review remains even after deleting all text; adoption and interview answer submission are distinct explicit actions. Speech cancellation resolves pending work; late voice availability is observed.
- Auth `/login`, `/register`, `/verify-email` use public `/auth/status`. Configured Clerk uses real SignIn/SignUp/UserProfile with Chinese localization. Local/unavailable modes include a labelled email form and clearly disabled mode-specific action with explicit Resend-unavailable reason; no password, email transmission, fake mail status or fake session. Local identity is labelled nonformal/nonteacher. Return paths reject external/protocol-relative/backslash/encoded redirects.
- Diagnostics record only finite safe metadata, no transcript/name/email/token/raw provider errors. `RequestError` provides retry where meaningful, safe copyable fields and user-invoked diagnostics download. Existing API errors are converted to safe Chinese recovery text. Backend request header correlation is retained for binary/error responses.

## Regression files added (not executed)

- `frontend/src/campus/hooks/__tests__/useAudioCapture.test.jsx`: onstart truth, stop cleanup/MIME, late permission after cancel/unmount, double-start gate, oversized final recording rejection.
- `frontend/src/campus/components/__tests__/VoiceInput.test.jsx`: ASR does not adopt automatically; clearing review keeps editor accessible; explicit adoption only.
- `frontend/src/campus/pages/__tests__/InterviewSessionPage.test.jsx`: old session response after route navigation cannot replace the current question.
- `frontend/src/campus/__tests__/api.test.js`: malformed 2xx JSON fails with requestId, ZIP remains Blob, bounded redacted diagnostics exclude body/query/UID.

## Parent verification commands and external boundaries

Run serially only after memory headroom and backend integration are ready:

```text
npm test --prefix frontend -- src/campus/hooks/__tests__/useAudioCapture.test.jsx src/campus/components/__tests__/VoiceInput.test.jsx src/campus/pages/__tests__/InterviewSessionPage.test.jsx src/campus/__tests__/api.test.js --maxWorkers=1
npm run lint --prefix frontend
npm test --prefix frontend -- --maxWorkers=1
npm run build --prefix frontend
```

All NOT_RUN here. No TypeScript command exists. Parent must exercise actual 360/390/768/1440 layouts, slogan animation/focus/reduced-motion, full text+voice resume workflow and PDF inspection, real model/ASR, denied microphone/navigation cancellation, lost-answer reconciliation, Chinese auth deep links and authorized teacher ZIP. Formal Clerk multiaccount behavior, real microphone/speaker/mobile quality and real generated PDF contents have not been observed in this slice. Resend is deliberately unavailable, not a passed mail delivery feature. No new frontend dependencies are required. Physical/GitHub rename, root docs and final quality reports remain parent-owned.

## Parent static-review follow-ups

Still edit-only; no checks or child processes run under critical host memory pressure.

- `components/Slogan.jsx`: replaced the accumulating timer array with two fixed timeout slots, cleared on completion/unmount.
- `auth.jsx`: refresh and initial capability loads share a monotonic sequence and AbortController; session changes, unmount and sign-out invalidate old responses. Local identity navigation now includes an explicit separate formal registration/login link.
- `pages/JobsPage.jsx`: dirty edits require confirmation before opening another job or creating a new one; successful reload/save resets dirty status. Company/title150, source500, skill80, evidence1000 now match backend limits.
- `pages/ProfilePage.jsx`: experience title150 and action text3000 match backend limits; other experience text remains2000.
- `components/TargetResumes.jsx`: list request generation invalidates stale initial/retry list responses when generation/edit/approval changes local variants, preventing late reads from erasing a newly generated or updated variant.
- Backend freshness amendment: target `stale:true`, `JOB_CHANGED` or `SOURCE_CHANGED` now shows explicit regeneration guidance, keeps old text readable/copyable, and disables stale-version edit/approval. Backend remains the export authority.

## FrontendFlowReview remediation

- Blank studyStage save/clear stays explicit; backend owner confirmed canonical schema accepts blank and added HTTP round-trip coverage. New frontend `pages/__tests__/ProfilePage.test.jsx` exercises form clear/save/reload.
- Resume dirty baseline is an actual empty snapshot, so untouched blank drafts do not prompt; metadata-only edits and cleared bodies do prompt before selection/new. Cancel retains all fields. New `pages/__tests__/ResumePage.test.jsx` covers these interactions.
- Known ASR/PDF/export codes now select fixed Chinese recovery messages without arbitrary upstream text; unknown422 is neutral rather than export-specific. Existing `__tests__/api.test.js` expanded with actual-code and redaction cases.
- Add the two new page test files to the parent's focused serial Vitest command above. All new/expanded checks remain NOT_RUN; no execution processes launched in this edit-only remediation.
- Parent reported six focused files/24 tests passed, then full frontend lint found two `no-control-regex` errors. Replaced filename and safe-return-path control regex ranges with character-code checks, preserving all prior control/separator restrictions. Child did not rerun checks; parent owns post-fix lint verification.

## Campus build graph and safe validation guidance

Parent observed production build exit134 at the explicit384MiB Node heap cap during transform; no child rerun and no heap increase. Static source tracing found `main.jsx` referenced both campus and upstream App dynamic imports; App imports portfolio galleries/template modules. `index.css` also imported Tailwind with broad source discovery.

- `frontend/vite.config.js` now resolves `@app-entry` and `@app-styles` from a configuration-time profile (`loadEnv(mode, frontendDir, 'VITE_')`, then process-env overrides). Campus selects only CampusApp and the new plain `frontend/src/campus/base.css`; noncampus selects new `frontend/src/fullAppEntry.jsx` and unchanged `index.css`. Existing direct App imports in tests are unaffected; no test shim or dormant dependency removal.
- `frontend/src/main.jsx` retains the shared React/Clerk/root boundary and imports the selected entry/style statically. New `fullAppEntry.jsx` owns the existing production-only immediate PWA registration and exports the original App. Campus disables Tailwind/PWA plugins, matching its existing no-service-worker policy; noncampus plugins and registration remain functional. Plain campus base includes margin0, box sizing, form font inheritance and paper colors; existing campus.css remains the workflow stylesheet.
- Backend contract `VALIDATION_FAILED` now carries max12 safe `{field,code}` records. New `frontend/src/campus/validation.js` independently bounds/allowlists them; api.js retains only that projection. RequestError renders Chinese field labels and fixed corrections for duplicate skills, dates, size/required constraints, with no raw input/messages/JSON in the field guidance. Diagnostic JSON still contains only technical correlation fields.
- New `frontend/src/campus/components/__tests__/RequestError.test.jsx` covers real error projection/rendering, private marker exclusion, unknown-field/code rejection and the12-detail bound. Add it to focused serial verification.

All post-isolation build/lint/browser and new validation tests remain NOT_RUN by this child. Parent owns the bounded-memory rebuild and visual checks after the stylesheet entry change.
