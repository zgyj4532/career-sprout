## Re-review result

Read-only inspection completed. No tests or other checks launched.

**Five findings are fixed. Two grounding findings remain partially open, and the revised experience-state ordering introduces one additional regression.**

### Open findings

#### [P1] Validate identity polarity against the complete supporting statement
**Location:** `backend/src/services/discoveryService.js:67–74`  
**Severity:** bug · **Status:** open · **Confidence:** 0.99

The original other-person/quoted examples are now rejected, but the new identity regex accepts a polarity-stripped excerpt. Concrete reproducer: accepted transcript `我不是大学生`; model candidate `collegeStudent: true` with source excerpt `大学生`. Source containment succeeds; `personalStatement` accepts attribution because the complete answer starts with `我`; the positive regex matches `大学生`, and the negative regex sees only that excerpt, so the candidate is accepted as true. The confirmation consumer can then persist the opposite of the explicitly stated identity. Check polarity in the complete supporting statement, not solely the model-selected substring. This is an explicit contradiction, not a requirement to resolve arbitrary linguistic ambiguity.

#### [P1] Preserve negation when validating an extracted achievement excerpt
**Location:** `backend/src/services/discoveryService.js:80–90`  
**Severity:** bug · **Status:** open · **Confidence:** 0.99

The exact full-excerpt reproducer is fixed, but a model-selected substring still bypasses it: accepted transcript `我没有完成网站开发`, experience candidate `{value: '网站开发', state: 'completed'}`, source excerpt `完成网站开发`. Containment and personal attribution pass; the new negation check examines only the excerpt; `完成` then qualifies it as completed. The candidate’s value is overwritten with that excerpt, actually removing the user’s negation from the saved experience. Validate the supporting clause in the accepted answer before treating an excerpt as a complete affirmative achievement.

#### [P2] Keep an ongoing plan classified as an idea
**Location:** `backend/src/services/discoveryService.js:88–89`  
**Severity:** bug · **Status:** open · **Confidence:** 0.99

The fix now gives any `正在` match precedence over explicit plan/not-started language. For accepted text `我正在计划做一个网站，还没开始`, an accurately extracted experience candidate with `state: 'idea'` is unconditionally changed to `in_progress`. Previously, the idea branch took precedence. Both frontend `materialText` and backend `renderImportedResume` exclude ideas but include in-progress entries, so this change incorrectly admits an unstarted plan into experience material. Preserve explicit not-started/plan semantics rather than interpreting the act of planning as implementation progress.

### Fixed findings

| Original finding | Status | Inspected evidence |
|---|---|---|
| Expired pending generation blocks another answer | **Fixed** | `interviewAnswers.js` now cancels expired pending admission and unsets its token before the answer CAS; the former generation guard can no longer commit. `continueDiscovery` also reconciles expiration before its early return. |
| Legacy explicit true becomes unknown | **Fixed** | `profileWrite.js` treats legacy `collegeStudent === true` as known; `profileTargets` reuses that same serialization. |
| Pre-write capacity change permanently freezes confirmation | **Fixed** | `discoveryConfirmation.js:169–171` releases an entirely unwritten ledger for `PROFILE_CAPACITY` and clears `confirmationPending`. |
| Gemini ignores output-generation bounds | **Fixed** | Adapter maps `maxTokens` to `generationConfig.maxOutputTokens` and forwards temperature, including zero, while retaining signal/timeout. |
| New formal feedback ignores selected language | **Fixed** | The `available-v1` prompt now appends `languageDirective(interview.language || 'en')`. |

### Normal statements and uncertainty display

- Normal clear self-statements remain accepted by the inspected branches: `我不是大学生`, `我的专业是数学`, `我喜欢绘画`, and `我想做一个网站，还没开始`.
- Contextual `目前大二` is accepted when answering a direct university/year question.
- `我正在做网站，但还没有完成` is retained as in progress.
- Attribution and negated-achievement rejections now produce `discovery.uncertainties`; `DiscoveryReport.jsx:79` explicitly renders those notices. That new value is not silently dropped.
- Conservative omission of quoted or attribution-ambiguous material is visible and does not fabricate replacement facts.

### Remaining test gap

`noviceSafety.test.js:36–38` always sets `source.excerpt` equal to the entire transcript. That helper prevents its grounding cases from exercising the valid wire shape in which the model selects a shorter substring—the exact bypass in both P1 findings. Add separate transcript/excerpt inputs, plus the ongoing-planning example above.

**Overall correctness: incorrect pending these three grounding corrections.** The other five reviewed fixes are supported by source inspection; test execution remains the parent’s responsibility.