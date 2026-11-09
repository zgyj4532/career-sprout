# Frontend flow/simplicity review — round1

Read-only FrontendFlowReview; static review only, no runtime/UI proof. All three have implementation fixes and added regressions; execution/re-review pending (NOT_RUN).

1. **bug/P1 — Blank studyStage blocks advertised optional profile save**, `pages/ProfilePage.jsx:35`: UI permits 暂不填写 but sends studyStage:''; connected legacy updateProfileSchema rejects blank. Align semantic contract so unknown stage can be saved/cleared without discarding valid existing year; server model already supports ''. Add actual form/schema round-trip regression, not only default assertion.
2. **bug/P2 — Empty-body unsaved resume changes discarded**, `pages/ResumePage.jsx:45-47` and new-empty action: guard `dirty && text` skips confirmation after body cleared or metadata-only edits. Dirty baseline should correctly represent a truly untouched blank draft; guard actual dirty regardless text truthiness. Keep cancel leaves every field untouched.
3. **bug/P2 — ASR failure wrongly says cannot export**, `campus/api.js:93-96`: legacy interview422 falls through PDF-oriented message and ASR_BUSY generic. Map known bounded codes to fixed client Chinese recovery (ASR_SILENCE/EMPTY_AUDIO/EMPTY/TOO_LONG/INVALID_AUDIO/BUSY, PDF_BUSY/RESUME_TOO_LONG/export busy) while rejecting arbitrary upstream text. Add representative actual-code behavior tests.

Implementation remediation:
- Finding1: frontend retains explicit blank save/clear semantics. Backend owner reports `updateProfileSchema` now accepts `''`, with HTTP save大三→clear→GET regression in campusIsolation. Added frontend `pages/__tests__/ProfilePage.test.jsx` form clear/save/reload regression; neither regression run here.
- Finding2: `ResumePage` now uses a concrete blank snapshot baseline; both selection and new-draft actions guard all dirty changes regardless body truthiness. Added `pages/__tests__/ResumePage.test.jsx` covering untouched blank, cleared body plus changed metadata, metadata-only draft and cancelled-discard field preservation.
- Finding3: `api.js` maps actual bounded ASR/PDF/export codes to fixed recovery text, including ASR_TOO_LONG/ASR_INVALID_AUDIO/ASR_BUSY; unknown422 uses neutral processing guidance rather than export advice. Added parameterized actual-code and unknown-provider redaction regressions to `__tests__/api.test.js`.


Runtime correctness remains unverified until parent executes checks and affected flows. Reviewer otherwise found inspected audio lifecycle/explicit review/teacher mappings/auth honesty/diagnostic bounds/slogan contracts aligned; visuals and animation still need browser proof. No blanket claim that all UI is verified.
