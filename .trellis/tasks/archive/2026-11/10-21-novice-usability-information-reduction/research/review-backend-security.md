# Backend security and recovery review

**Result:** Six open findings. Read-only source review; no files changed, payloads executed, network calls made, or tests/builds run. Reproduction sequences below are **[INFERENCE] from the inspected execution paths**, not exercised results.

Intended report: `research/review-backend-security.md`. Parent should persist this report.

## yield — Findings

### 1. [P1] GDPR erasure omits discovery-confirmed interests and experiences

**Severity:** bug · **Status:** open  
**Locations:** `backend/src/routes/gdpr.js:59-74,135-154`; `backend/src/campus/discoveryConfirmation.js:65-71,93`

Discovery confirmation writes interests and source-linked experience quotations into `CampusStudent`. GDPR export and deletion include the new confirmation ledger but never query or delete `CampusStudent`. Deleting the interview and its ledger therefore leaves confirmed conversation material, including `fullText`, `sourceConversationId`, and `sourceQuestionId`, attached to the account.

**Reproducer:**
1. In the ordinary backend deployment, complete a discovery conversation and confirm an interest or experience.
2. Request `/api/gdpr/export`: the canonical student record is absent.
3. Request `DELETE /api/gdpr/delete`: it reports successful deletion.
4. Inspect `CampusStudent` for that UID: the confirmed material remains.

**Exposure qualification:** Campus-local deliberately disables GDPR (`backend/src/campus/profile.js:30`). However, the ordinary server mounts both the shared discovery routes and GDPR routes (`backend/src/index.js:335,352`), so this is a reachable integration defect, not a claim about a disabled campus endpoint.

**Required correction:** Include the canonical records newly written by discovery in export/erasure, with their actual owner key (`uid`), not only their workflow ledgers.

---

### 2. [P2] Resume deletion retains full copies in save-operation ledgers

**Severity:** bug · **Status:** open  
**Locations:** `backend/src/campus/materialSave.js:54,74,100`; `backend/src/campus/resumeDelete.js:56,77-85`; `backend/src/campus/models.js:123-129`

Every operation stores resume content inside `frozen.document` and `frozen.result`; completion stores another result. Normal resume deletion removes the resume and its versions/associations but neither removes nor redacts the corresponding `CampusSaveOperation` records. The ledger has no expiry.

The tombstone correctly prevents recovery from returning the deleted resource, but does not erase these retained copies. In the ordinary deployment, GDPR export explicitly returns them (`backend/src/routes/gdpr.js:74,98`).

**Reproducer:**
1. Create or update a resume containing a distinctive private passage using `operationId`.
2. Delete it through `DELETE /api/resumes/:resumeId`.
3. Inspect the matching save-operation records—or export account data in the ordinary deployment.
4. The deleted text remains in the operation snapshots.

**Required correction:** Extend resource deletion to scrub content-bearing operation snapshots, preserving only minimal cancellation/idempotency metadata if necessary.

---

### 3. [P1] A pending create retry can resurrect a deleted resume

**Severity:** bug · **Status:** open  
**Locations:** `backend/src/campus/materialSave.js:115-132`; `backend/src/campus/resumeDelete.js:38-52,77-85`

Resume updates use the shared association lock, but resume **creates and create retries bypass it**. Their tombstone check occurs before the target lookup and insertion. The later tombstone check in `finishSave` only throws; it does not remove a resume already reinserted after deletion.

**Reproducer:**
1. Commit a resume create, then interrupt its ledger completion, leaving a pending operation with an existing target receipt.
2. Retry that same operation and pause after `alive(ledger)` succeeds at line 115.
3. Delete the resume normally; deletion writes its tombstone and removes the resource.
4. Resume the retry. Its target lookup finds nothing, and `frozen.create` inserts the original document at line 121.
5. `finishSave` detects the tombstone and returns an error, but the resurrected resume remains.

**Impact:** Deleted private content returns to canonical storage despite the anti-resurrection tombstone and failed retry response.

**Required correction:** Serialize create/retry admission with deletion using the same resource lock, and check the tombstone inside that protected operation immediately before insertion.

---

### 4. [P2] Expired confirmation workers can apply a superseded conflict decision

**Severity:** bug · **Status:** open  
**Locations:** `backend/src/campus/discoveryConfirmation.js:82-97,121-143`

Lease ownership is enforced on ledger checkpoints, but not on the target mutation. `applyPlan` receives no lease token and checks only the target baseline and receipt. A worker paused after its last checkpoint can write after another worker has taken over and completed with a different permitted conflict resolution.

**Reproducer:**
1. Existing major is `A`; the frozen candidate proposes `B`.
2. Request A chooses `replace`. Pause it after the checkpoint at line 140, before `applyPlan`.
3. Let its five-minute lease expire.
4. Request B retries the same frozen candidates, choosing `keep` for the major. That change is explicitly allowed; B can complete without writing a profile receipt.
5. Resume A. The profile still matches A’s baseline and has no receipt, so A writes major `B`.
6. A’s following checkpoint rejects its stale token, but the profile change has already committed.

**Impact:** A completed “keep existing” decision is overwritten by an expired worker.

**Required correction:** Fence target writes against takeover, not only ledger updates. The coordination must also cover targets intentionally skipped by the recovering worker; a checkpoint immediately before a separate write is not sufficient across a pause.

---

### 5. [P2] Expired generation leases still block answer saving and deletion

**Severity:** bug · **Status:** open  
**Locations:** `backend/src/services/interviewAnswers.js:5-7`; `backend/src/routes/interview.js:548-554`; `backend/src/services/interviewWorkflow.js:17-19,41-45`

Generation takeover recognizes expiry, but answer persistence and deletion reject every `generation.status === 'pending'`, regardless of `leaseUntil`. No expiry transition clears that status independently.

**Reproducer:**
1. Start completion while a displayed question remains unanswered.
2. Stop the process after pending generation admission; restart after the lease expires.
3. Try to save the outstanding answer: persistence rejects it.
4. Try deleting the session: deletion rejects it.
5. For discovery, `/continue` returns the unchanged session when an unanswered question exists, so that endpoint does not recover this state either.

Completion retry can recover by generating a summary, but that is not equivalent to saving the outstanding answer or cancelling/deleting the session. If generation remains unavailable, deletion remains blocked.

**Required correction:** Provide an atomic expired-generation cancellation/recovery transition, preserving token fencing so the abandoned worker cannot subsequently commit.

---

### 6. [P1] GDPR deletion does not fence already-admitted material writes

**Severity:** bug · **Status:** open  
**Locations:** `backend/src/routes/gdpr.js:135-154`; `backend/src/campus/materialSave.js:109-132,71-75`

GDPR deletion directly deletes resources and operation ledgers without coordinating with admitted writers or leaving an account-erasure barrier. `saveMaterial` retains the acquired ledger in memory and does not require that ledger to still exist before inserting the target. `finishSave` also ignores whether its ledger update matched anything.

**Reproducer:**
1. Begin a resume create with `operationId`; pause after lease acquisition, before target insertion.
2. Complete `DELETE /api/gdpr/delete`. It removes the ledger and any current resumes and returns success.
3. Resume the admitted create.
4. It creates the resume and initial version. No resume tombstone was written by GDPR deletion.
5. The completion update matches the now-deleted ledger zero times, but the function still returns its saved result.

**Impact:** Personal data reappears after successful account-data erasure, without a corresponding recovery ledger.

**Required correction:** Coordinate erasure with in-flight writes through an account-scoped deletion barrier/admission contract. Merely adding more collections to `deleteMany` does not close this race.

## yield — Positive invariants observed

These are source-level observations, not certification or passing runtime evidence.

- **Owner isolation:** Interview lookup and mutation use both session ID and authenticated `userId`. Confirmation endpoints first resolve an owned interview. Save-operation recovery is scoped by `{kind, userId, operationId}`; resource ownership is server-derived.
- **Client-controlled payloads cannot select arbitrary confirmation fields:** Strict confirmation schemas allow reviewed candidate IDs/values/states, and candidate IDs must exist in the owned session. Model-provided ownership or collection names never become write targets.
- **Bounded discovery input/output:** Discovery answers enforce 4,000 characters per answer, 40,000 per session, and bounded turns. Generated results undergo bounded JSON/schema validation.
- **Prompt-data boundary:** Conversation material is JSON-encoded and explicitly labelled untrusted. Source references must match an accepted answer ID and an exact transcript substring. This is a meaningful structural boundary, though not proof of semantic grounding for every possible phrase.
- **No automatic profile or privilege writes from generation:** Summary generation produces candidates only. Viewing confirmation is read-only; explicit confirmation targets profile/student fields, not resumes, grants, publication status, or skill assessments.
- **Receipt recovery protects later edits in the normal path:** Confirmation receipts are atomic with target writes. Recovery recognizes them before replay, so a lost ledger acknowledgement does not ordinarily overwrite a subsequent user edit.
- **Stale-edit controls participate across callers:** Ordinary profile writes use `expectedUpdatedAt`; blind writes are rejected after discovery receipts exist. Import write/restore CAS includes confirmation receipts. Resume updates require revision equality.
- **Material payload binding:** Operation IDs are validated and unique per owner/kind; canonical payload hashes reject reuse for different content. Recovery deliberately returns the original acknowledged version rather than silently substituting newer content.
- **Generation commit fencing:** Interview generation writes require the admitted token and unchanged answer/question counts. Completed replay returns stored results without another model call. Discovery timeout cancellation is passed to the provider and awaited.
- **Score/evidence separation:** Discovery is excluded from formal analytics and interview counts. Missing observations remain unavailable rather than zero. Matching uses explicit skill assessments; discovery does not create them. Resume projection excludes idea-state experiences and labels in-progress entries unfinished.

## yield — Coverage and verification boundary

Reviewed the five assigned modules, their Interview/UserProfile/Resume/campus models, interview/resume/profile/campus/GDPR routes, request schemas, ordinary write helpers, import confirmation and restoration, resume deletion/revision coordination, scoring/matching boundaries, provider option propagation, route registration, and the two novice workflow/recovery test files.

**Not performed:** execution, fault injection, model calls, tests, build, lint, formatting, or edits. Existing tests were read, not reported as passing.

Parent verification should add controlled cases for the six sequences above, particularly stale-lease takeover and deletion between admission and target mutation. This review makes no broader security-certification claim.