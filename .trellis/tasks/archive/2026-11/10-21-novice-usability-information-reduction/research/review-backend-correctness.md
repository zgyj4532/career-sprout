# Backend correctness review

Read-only review; no source edits, builds, tests, formatters, or runtime calls. Report content is supplied here for the parent to persist as `research/review-backend-correctness.md`. Reproducers below are derived from the inspected code, not executed.

## Findings

### [P1] Require evidence that extracted identity belongs to the speaker
**Location:** `backend/src/services/discoveryService.js:56–62`  
**Severity:** bug · **Status:** open · **Confidence:** 0.99

The grounding checks accept another person’s identity as the user’s own. For example, with the accepted transcript/excerpt `我的朋友是大一学生`, a model candidate `{kind: 'collegeStudent', value: true}` passes the positive regex because `我.{0,8}大一` matches the whole phrase. Likewise, `我朋友的专业是数学` supports a `major: 数学` candidate under the substring/keyword check. `confirmationView` forwards these candidates to the confirmation UI, and `confirmDiscovery` writes an unchanged confirmation into the user’s identity/education. Verify the subject and relationship in the supporting statement; mere substring containment must not establish ownership of a fact.

### [P1] Reject negated achievements before accepting completed experience
**Location:** `backend/src/services/discoveryService.js:68–70`  
**Severity:** bug · **Status:** open · **Confidence:** 0.99

An accepted answer/excerpt `我没有完成网站开发` with an experience candidate marked `completed` passes grounding: it contains none of the idea/in-progress patterns, while `完成` satisfies the completed-evidence regex despite being negated. Confirmation preserves `state: completed`, and both `renderImportedResume` and frontend `materialText` include it without an unfinished label. The full quote preserves the words but does not repair the false structured achievement classification. Reject negated completion claims or retain an explicitly supported unfinished state rather than accepting the model’s completed classification.

### [P2] Release expired generation admission before accepting another answer
**Location:** `backend/src/services/interviewAnswers.js:6`  
**Severity:** bug · **Status:** open · **Confidence:** 0.99

If the process exits after admitting an early completion but before persisting its result, the session retains `generation.status: pending` after `leaseUntil` expires. The frontend’s `generationPending()` correctly treats that expired lease as inactive and enables the existing unanswered question, but every answer POST still fails this unconditional pending-status predicate. For discovery, `/continue` also returns immediately while that unanswered question exists, so it cannot clear the expired operation. A user cannot resume answering after this recoverable interruption without instead completing the session. Reconcile expired admission atomically while ensuring the former generation token can no longer commit.

### [P2] Preserve explicit true identity on legacy profiles
**Location:** `backend/src/campus/profileWrite.js:25`  
**Severity:** bug · **Status:** open · **Confidence:** 0.99

A pre-patch profile containing `collegeStudent: true` has no `collegeStudentKnown` flag, so this serializer now returns `collegeStudent: null` and `collegeStudentKnown: false`. Unlike the legacy default `false`, legacy `true` was not a schema default and represents an explicitly stored selection. `profileTargets` repeats the same interpretation, allowing a discovery candidate of `false` to overwrite that existing true value without the normal conflicting-value choice. Preserve legacy explicit true values as known in both read serialization and confirmation comparison; only genuinely ambiguous defaults should become unknown.

### [P2] Unfreeze a confirmation when capacity changes before its first write
**Location:** `backend/src/campus/discoveryConfirmation.js:161–166`  
**Severity:** bug · **Status:** open · **Confidence:** 0.97

Capacity is checked once before creating the ledger and again after acquiring it. Reproducer: start with 19 interests and confirm one new interest; after the initial preflight/ledger creation, another ordinary writer adds a twentieth interest. The second `buildPlans` throws `PROFILE_CAPACITY` before either confirmation target is written, but the catch only deletes an uncommitted ledger for `PROFILE_CONFLICT`. It instead leaves a frozen partial confirmation. The UI disables removing the candidate, edited candidates receive `CONFIRMATION_FROZEN`, and session deletion is blocked by the pending ledger. Release an entirely unwritten confirmation for this pre-write capacity failure so the user can reduce or skip the new material without deleting existing profile c…

### [P2] Honor the requested output-token limit in the Gemini adapter
**Location:** `backend/src/config/aiProviders.js:49–51`  
**Severity:** bug · **Status:** open · **Confidence:** 0.99

The new discovery and completion callers pass `maxTokens: 6000` and `maxTokens: 4000`, respectively, but the Gemini adapter forwards only signal and timeout. Its model was constructed without a generation configuration, so these requests run with the model’s default output limit rather than the operation’s requested bound; `temperature: 0` is also discarded. Rejecting an oversized response after generation does not bound the upstream work or cost. Map these options to Gemini’s `generationConfig.maxOutputTokens` and temperature while retaining cancellation handling.

### [P2] Retain the selected language for new formal-interview feedback
**Location:** `backend/src/services/interviewService.js:449–452`  
**Severity:** bug · **Status:** open · **Confidence:** 0.99

Every new formal interview uses `available-v1`, whose completion branch now instructs the provider to act as a Chinese-language coach and never includes `interview.language` or the existing `languageDirective`. An interview started with `language: 'en'`, `'es'`, or another supported language still generates its questions and per-answer feedback in that language but requests its final report in Chinese. The legacy completion branch preserves the selected-language directive. Apply the same language contract to the new score-policy branch rather than tying scoring version to Chinese output.

## Behavior-test gaps

The new suites cover useful persistence behavior: real Mongo target receipts, lost acknowledgements, concurrent completion admission, replay, empty discovery, true zero, missing dimensions, and legacy completion weighting. The following missing cases correspond directly to the defects above:

- Other-person and quoted identity/major statements, plus negated completed achievements.
- Process death with an **expired pending lease**, followed by saving an existing unanswered question—not only a provider exception that marks generation failed.
- Legacy `collegeStudent: true` without the newly introduced provenance flag.
- Capacity changes between confirmation preflight and the first target write, including whether the user can revise or skip afterward.
- Gemini generation-option forwarding and non-Chinese `available-v1` completion prompts.

## Other inspected boundaries

- Discovery start, answer, continue, completion, and confirmation envelopes match their inspected frontend consumers.
- Empty discovery completion avoids the provider, and completed-session replay returns persisted results.
- Available-dimension aggregation includes genuine zero, excludes unavailable dimensions from its weighted denominator, and persists observation coverage/comparison keys. Discovery is excluded from the inspected analytics and profile-count paths.
- Resume/job operation IDs, recovery endpoints, owner scoping, target receipts, and frontend recovery dispatch are connected.
- The focused workflow, scoring, confirmation, and material-save modules are proportionate to their responsibilities; no separate generic-framework maintainability finding.

**Overall correctness: incorrect.** The patch contains actionable grounding, recovery, legacy-provenance, and provider/language-contract defects. **Overall confidence: 0.98.**

[Some lines truncated to 768 chars. Use agent://BackendCorrectnessPlan:raw:35-35 to read line 35 whole]