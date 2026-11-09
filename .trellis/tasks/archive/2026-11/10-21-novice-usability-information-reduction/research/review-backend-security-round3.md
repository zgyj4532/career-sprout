# Final privacy re-review

**Result:** The original six findings remain **fixed in static review within the documented single-process boundary**. The ordinary-profile privacy fix closes the new-record disclosure and cache bypass paths, but **one transition case remains open**.

No tests, runtime checks, network calls, or edits were performed.

## yield — Open finding

### [P2] A subsequent confirmation drops legacy privacy protection for untouched fields

**Severity:** bug · **Status:** open  
**Locations:**  
- `backend/src/campus/discoveryConfirmation.js:66-67`
- `backend/src/campus/profileWrite.js:36-37`

The public projection conservatively hides identity and education when a profile has old confirmation receipts but lacks `discoveryPrivateFields`. However, the next confirmation initializes explicit privacy markers from `[]`, rather than preserving that effective legacy protection.

Once the explicit array exists, `publicProfileJson` stops applying its legacy fallback. Previously confirmed fields not touched by the new confirmation become publicly readable.

**Reproducer — [INFERENCE] from source; not executed:**
1. Start with a profile created by the earlier confirmation implementation: it has `confirmationReceipts`, a discovery-confirmed major, and no `discoveryPrivateFields`.
2. A foreign-account profile read correctly omits education through the fallback.
3. Complete another discovery session and confirm only `collegeStudent`.
4. Line 67 writes `discoveryPrivateFields: ['collegeStudent', 'collegeStudentKnown']`.
5. A foreign-account read now returns the earlier discovery-confirmed education because the explicit array suppresses the fallback.

The inverse also occurs: confirming only a major can expose previously confirmed attendance status.

**Required correction:** When initializing explicit markers on a record with existing confirmation receipts, union the newly written fields with the same conservative legacy field set used by the public projection. Add a persisted old-record → new-confirmation → foreign-read regression; the current standalone legacy projection assertion does not cover this transition.

## yield — Fixed and retained invariants

- **New confirmations:** Privacy markers and their corresponding profile facts are written atomically with the receipt (`discoveryConfirmation.js:66-67,94`).
- **Foreign reads:** Cache bypass occurs before lookup, and the route selects the filtered projection for nonowners (`services/profileCache.js:34-39`; `routes/userProfile.js:152-156`).
- **Owner reads:** Retain identity/education values while internal privacy markers and receipts are removed from normal serialization.
- **Client tampering:** The ordinary update schema does not accept privacy markers. Import writes and restoration use scoped field updates, preserving existing markers.
- **Previous six fixes:** Account admission/draining, interrupted-erasure retry, canonical GDPR deletion, snapshot scrubbing, create/delete serialization, active confirmation admission/keep receipts, and expired generation token cancellation remain present.
- **Deadlocks:** No concrete deadlock found in the reviewed nested account/resource-lock paths. This does not establish distributed-process safety.

## yield — Coverage and verification boundary

Re-read privacy projection, cache ordering, profile routes/model metadata, atomic confirmation plans, import preservation paths, the new two-account route regression, and the prior recovery/deletion fixes.

The new regression covers owner versus foreign reads, query/no-query cache bypass, schema rejection of marker clearing, and standalone legacy projection. It does **not** cover the legacy-to-explicit-marker transition above.

**Open findings: 1. Zero-open is not yet warranted.** Parent retains ownership of post-fix verification; no security certification is claimed.