## Final correctness verdict: correct

**No findings. All 8 original findings are fixed, including the subsequent profile-reconciliation issues A/B and the failed-recovery follow-up. Zero open bugs; zero new findings.** Confidence: **0.96**.

### Final profile-recovery closure

The previously open lost-response + failed-recovery case is now addressed:

- **Retains submitted intent:** `ProfilePage.jsx:109-110` stores `{ desired, plan }` and marks the outcome unknown.
- **Keeps editing frozen:** `saveUnknown` contributes to `busy` at `:21-23`; the form—including discard—is disabled at `:123`, imports at `:120`, and navigation remains guarded at `:29`.
- **Recovery reads only:** `recoverSave` at `:46-53` performs a canonical GET without submitting another write. Repeated failure leaves the retained attempt and freeze intact.
- **Rebases before unlocking:** `applyRecovery` at `:55-66` compares each actual target independently, rebases confirmed fields using the retained intent, then clears uncertainty. Later intentional **B → A** edits are no longer treated as untouched.
- **Regression present:** `ProfilePage.test.jsx:271-309` covers lost acknowledgement, failed immediate and repeated recovery reads, retained locked text, successful read-only recovery, and subsequent **B → A** persistence with unfinished growth material preserved.

### All-eight status

| # | Finding | Status |
|---|---|---|
| 1 | Profile lost-response/conflict recovery | **Fixed**, including independent student education, acknowledged-field rebasing, and unavailable-recovery freezing |
| 2 | Explicit unknown attendance overwritten on unrelated save | **Fixed** — boolean/null remains explicit |
| 3 | Post-save refresh failure downgrades acknowledged material save | **Fixed** — uncertainty clears on acknowledgement; refresh errors are separate |
| 4 | Discovery confirmation acknowledgement discarded | **Fixed** — canonical POST result is applied directly |
| 5 | Transcription retry bypasses parent admission | **Fixed** — shared entry guard and disabled/busy retry suppression remain |
| 6 | Adaptive progress mixes incompatible scoring scopes | **Fixed** — comparison-key groups and separate historical progress remain |
| 7 | Analytics drops unscored formal sessions | **Fixed** — complete session list is separate from comparable numeric records |
| 8 | Per-answer cards manufacture missing zeros | **Fixed** — observed-only values, unavailable labels, and genuine zero remain distinct |

**Evidence limits:** This is a static correctness review, not an execution pass. I ran no tests, builds, lint, formatters, browser/runtime checks, or file edits. The latest recovery regression still requires Main’s verification against the final source; results from earlier frontend snapshots do not establish that final check. Report persistence remains with Main under this reviewer’s read-only restrictions.