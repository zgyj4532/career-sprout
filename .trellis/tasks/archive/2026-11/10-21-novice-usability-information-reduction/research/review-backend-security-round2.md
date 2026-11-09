# Backend security re-review

**Result:** All six original findings are **fixed in static review within the documented single-writer-process boundary**. One additional privacy integration finding remains **open**.

No tests, runtime checks, network calls, or edits were performed. The parent’s earlier 103/103 pass predates these fixes and is not verification of them.

## yield — Original findings

| # | Status | Source evidence |
|---|---|---|
| **1 — GDPR omits discovery-confirmed canonical material** | **Fixed in static review** | `routes/gdpr.js:77-79,130-132` now exports and deletes `CampusStudent` by `uid`, plus campus jobs and preparation using their proper owner fields. |
| **2 — Deleted resume content retained in operation snapshots** | **Fixed in static review** | `campus/resumeDelete.js:83-86` marks matching operations cancelled and removes `frozen`, `result`, and lease fields. GDPR performs equivalent account-wide scrubbing at `routes/gdpr.js:120-121`. Cancelled operation IDs remain available to reject old retries without retaining text snapshots. |
| **3 — Pending create retry resurrects deleted resume** | **Fixed in static review** | `campus/materialSave.js:126-143` rechecks liveness inside the same resume lock used by deletion and keeps target mutation, initial-version creation, and acknowledgement inside that lock. Recovery also finalizes under the lock at `:96-97`. Completion checks the ledger update’s matched count at `:76-77`. |
| **4 — Expired confirmation worker applies superseded decision** | **Fixed in static review, single-process boundary** | `campus/discoveryConfirmation.js:103-109` retains active admission until the operation settles, preventing an in-process takeover merely because the lease expires. Plans now distinguish “considered” from “changed” at `:80-81`; keep decisions receive atomic target receipts through `:89-96,150-154`. |
| **5 — Expired generation blocks answering/deletion** | **Fixed in static review** | `services/interviewAnswers.js:5-8` atomically transitions expired pending generation and unsets its token. Answer persistence calls it before saving; discovery continuation calls it before its early-return branches; interview deletion calls it at `routes/interview.js:550`. Old workers cannot satisfy their original token/status commit guard afterward. |
| **6 — Admitted material write survives successful GDPR erasure** | **Fixed in static review, single-process boundary** | `campus/accountWrites.js:25-56` closes admission, drains active work, persists deleting/epoch state, runs erasure, then reopens. Material saves/recovery and the relevant HTTP handlers participate. `routes/gdpr.js:114-138` uses the barrier, resource deletion, snapshot scrubbing, and canonical cleanup. |

## yield — Additional open finding

### [P1] Discovery-confirmed identity and major become readable by other accounts in the ordinary deployment

**Severity:** bug · **Status:** open  
**Primary location:** `backend/src/routes/userProfile.js:152-156`  
**Related locations:** `backend/src/campus/discoveryConfirmation.js:58-63`; `backend/src/index.js:330,346`

The new discovery flow writes confirmed attendance status and major into ordinary `UserProfile` fields. The existing `GET /api/user-profiles/:uid` route returns those fields to any authenticated account unless `req.campusRequest` is set.

That restriction protects the campus server, whose diagnostics middleware sets the marker. The ordinary server mounts the shared discovery and profile routes without that marker. `profileJson` removes confirmation receipts, but does not remove `collegeStudent`, `collegeStudentKnown`, or education fields. Thus “save to personal profile” exposes newly confirmed conversation facts through the existing public-profile reader, without a separate publication decision.

**Reproducer — [INFERENCE] from source, not executed:**
1. Run the ordinary backend entry point.
2. Account A completes discovery and confirms its university-attendance status or major.
3. Account B, knowing A’s UID, requests `GET /api/user-profiles/<A_UID>?fresh=1`.
4. The query parameter bypasses the profile cache (`services/profileCache.js:34-44`), and the handler returns A’s newly confirmed identity/education data without an ownership or publication check.

**Impact:** Cross-account disclosure of facts gathered through the new private discovery-confirmation workflow.

**Scope qualification:** This does **not** bypass the campus-local owner check. It is an ordinary-deployment integration defect in the newly added write path, not a claim that the review fixes themselves introduced the public-profile route.

**Required correction:** Keep discovery-confirmed private facts out of the public profile response unless explicitly published, or constrain the discovery feature to deployments where its private-data contract is enforced. Address cache ordering as part of any authorization change.

## yield — Admission, retry, and privacy checks

- **No concrete deadlock found in the inspected call paths.** Nested account operations reuse the same `AsyncLocalStorage` admission rather than registering work that waits on itself. Erasure establishes its ownership context before calling `deleteResumeOwned`. Material initial-version creation no longer recursively acquires the already-held resume lock.
- **Pre-admission races are covered structurally.** Reference counting keeps the gate alive while a request awaits its first state lookup; generation comparison rejects requests that span an erasure. The second state lookup checks durable epoch/deleting state after active registration.
- **Interrupted erasure remains retryable.** Failure leaves durable `deleting: true`; ordinary writes reject, while explicit erasure retry can enter and finish. Successful erasure reopens admission. Old cancelled operation IDs remain rejected; new operation IDs can onboard again.
- **Campus privacy remains intact in the reviewed paths.** Confirmation starts from an owned interview; student reads are owner-scoped; campus cross-account profile reads remain denied before cache lookup. New state documents and operation snapshots have no new public reader. The ordinary-profile exception is the finding above.
- **Boundary remains explicit:** the process-local admission sets and locks are not distributed fencing. This re-review does not extend their guarantees to concurrent writer processes.

## yield — Coverage and verification boundary

Re-read the changed account admission module, GDPR export/erasure, material saving/recovery, resume deletion, discovery confirmation, generation expiry handling, participating route wrappers, profile serialization/privacy/cache paths, account-state schema, and the added safety/isolation regression cases. Traced nested resume/account lock callers and ordinary versus campus route registration.

The new tests contain targeted cases for the original six findings and the pre-admission race; they were **read, not run**. Parent should retain post-fix targeted verification and add a two-account ordinary-deployment privacy case for the open finding.

**Open findings: 1. Original findings remaining open: 0 within the stated single-process boundary. No security certification is claimed.**