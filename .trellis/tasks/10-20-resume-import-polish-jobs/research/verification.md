# 2026-10-20 continuation verification

Status: reachable implementation and exercised local flows delivered; human usability/formal-account acceptance remains open. No task created/activated, no commit/push, no archive. Existing user changes preserved. This report distinguishes observed evidence from external acceptance.

## Task inventory and real blockers

- `00-bootstrap-guidelines`: six frontend spec files and index populated with actual code examples; content ready, developer review/archive separate.
- `10-15-*` and `10-18-*`: prior local model/ASR/PDF/teacher authorization evidence remains in their dated reports. Current Clerk configuration still absent; real accounts/human devices cannot be counted as passed.
- `10-18-career-sprout-brand`: old directory-lock blocker resolved. Doctor/dev:local executed from career-sprout; existing resumes/profile read200, Mongo/Redis healthy. Database/volume identifiers unchanged.
- `10-19-effortless-career-experience`: prior light changes retained. First four substantial Issue #1 features continued in this task. Default-recent-resume, merged recording editor and missing-score aggregation remain outside the explicitly approved four-item task.
- `10-20-resume-import-polish-jobs`: source retention, structured extraction, confirmation/recovery, job screenshots, section polish, resume revision/deletion and prep persistence implemented. Real sample results below do not substitute for 3–5 novice students.

## Defects discovered and fixed

- Empty `ImportConfirm(null)` caused actual `/profile` blank screen.
- Existing import route fabricated counts, never mapped structured fields, and did not create a missing resume.
- PDF.js 1.10 operator inspection invoked DOM font loading after first block. Set actual `pdfjs.PDFJS` headless settings; real first PDF and headless regression passed.
- Node24 default fetch ignored existing proxy variables; direct model host failed EHOSTUNREACH. `NODE_USE_ENV_PROXY=1` made the same endpoint and Luna model work. Launcher respects explicit override.
- Mongoose hydrated arrays failed structuredClone with code25 in actual upload, despite plain-object tests. Snapshot with `toObject()` before IPC/model processing; recovered same original and persisted model response without another provider call.
- Model-produced concatenated otherMaterials was validated as a contiguous quote although then discarded. Removed that model field; server reconstructs leftovers only.
- Revision CAS, tombstone-first deletion/association exclusion, comment ownership/expired-share checks, fresh profile reads, profile statistics owner queries.
- Canonical education could be overwritten by imported subset; separated owners. Unknown skills now survive ordinary edits/matching as unknown, normalized duplicate labels collapse preserving existing assessments.
- Preflight save/restore conflicts formerly trapped original storage forever. Clean conflicts can return to review/discard; potentially partial execution remains frozen/recoverable.
- Import completion could clobber parent edits; mutation lock now spans final refresh. Mobile save bar sits above fixed navigation. Selected concise text honored downstream. New-resume confirmation says create, not update.
- Screenshot retry mutation raced lease admission; received source order now immutable (reorder/delete before upload). Slow upload lease renewed; cleanup releases quotas only after material removal.
- Imported resume renderer repeated metadata already in full text. Missing-only metadata rendering fixes this without rewriting stored source.
- Actual polish omitted a negative fact; guard correctly rejected it. Prompt now explicitly preserves exact negative clauses and degree words in the draft. Synthetic provider output then preserved the full qualification.

## Executed engineering checks

| Check | Observed result |
| --- | --- |
| `node scripts/local/doctor.mjs` via WSL |PASS; selected Node24.14.1, dependencies present, model key set, Clerk absent|
| Initial frontend campus suite |46/47 passed; unknown proficiency projection failed while edits were ongoing|
| Focused finalized Profile/Interview/ImportPanel/JobImageImport |15 tests passed, exit0|
| Final frontend campus suite, one worker |14 files /61 tests passed, exit0;259.39s|
| Scoped frontend lint, campus + changed legacy callers |PASS exit0|
| Campus production build, Node384MiB |PASS539modules,17.27s; JS540.89kB/gzip170.58; existing >500kB warning retained|
| Initial backend campus suite with unintended npm child Node20 |72/75 passed; ledger.steps missing and synthetic PDF failure recorded, not hidden|
| Corrected Node24 PATH backend campus suite |79 tests /6 suites passed, exit0;239.32s|
| Latest changed backend + schemas targeted suite |153 tests /32 suites passed, exit0;98.16s|
| Scoped backend lint |Initial control-regex error corrected; final full changed-scope lint PASS exit0,15.46s|
| Actual modified dev-local launcher |API started, health200 with Mongo/Redis before frontend process; Vite Local ready afterward. Own service stopped and ports confirmed empty|
| Final safe partial extraction regressions |19 tests passed on Node24, exit0; unsupported fields absent, raw retained, explicit issues|
| Final persistence and salvage checks |9-test persistence run passed; subsequent focused HTTP/Mongo salvage/provenance test passed including ordinary edit roundtrip|
| Last frontend source-excerpt/material changes |3 files /20 tests passed, exit0;88.11s|

No TypeScript gate exists. Broad dormant-backend lint has known pre-existing errors documented in the earlier report; it was not rerun merely to reproduce them. Mongoose deprecation warnings remain visible; no rule or warning suppression.

## Real model/corpus evidence

10 content groups, 30 files (PDF/DOCX/PNG).

1. Initial execution: PDF0/10 parse; DOCX10/10 parse; image headers10/10; all20 model calls failed transport. PDF DOM and proxy root causes corrected.
2. Second execution: all30 parse passed; structured PDF3/10, DOCX5/10, PNG4/10. Most rejects were the unused model-owned otherMaterials field. Exact per-file metadata is in `corpus-2026-10-20-before-grounding-fix.json`; this is a recorded failing run, not acceptance.
3. After removing the dead field: all30 parse passed;22 structured responses accepted (PDF8/DOCX6/PNG8). Remaining schema failures were untitled experiences; one image combined disjoint evidence. Exact run: `corpus-2026-10-20-grounding-pass22.json`.
4. Final decoder accepts missing experience titles by using a labelled literal source excerpt. Unsupported scalar fields are blanked; invalid entries omitted; original text retained with explicit review issues. Replaying the same30 captured real responses yielded30 reviewable results, **not30 fully accurate/complete resumes**, and spent no additional model calls. See `corpus-2026-10-20-replay.json`.
5. Fresh final-model requests for one content group in PDF/DOCX/PNG each completed with one Luna call and a reviewable result; all retained source and uncertainty. See `fresh-formats-2026-10-20.json`. DOCX still required several factual/source-association checks; automatic success does not prove low human effort.

All30 private raw model checkpoint files and25 owned smoke/diagnostic/fixture outputs were removed after verification, along with the temporary PDF-inspection environment. Retained evidence contains only group/format/count/error metadata and explicitly synthetic examples, not personal source text or keys. Nothing was committed.

## Actual browser/API smoke

Dedicated synthetic database `career_sprout_audit_20261020`, UID `career-sprout-audit-20261020`; not production authentication evidence. See `browser-api-smoke-2026-10-20.json`.

- Failed uploaded DOCX remained discoverable; after boundary fix, Continue reused original/received model output. Actual mobile confirmation persisted one resume. Repeat confirmation retained count1.
- Ordinary profile save/read preserved month/current text, full negative qualification, and unknown proficiency.
- Rename200 kept contentRevision1; stale body409; restore after later edits409 and subsequent GET remained saved with source retained.
- Two actual synthetic screenshots extracted two same-title cities, correct SQL/Python requirements and3/4days. Saved private job and account preparation200.
- Browser recovered both originals, required selection between conflicting cities, saved chosen job, returned to original preparation with6questions/text/manual direction. Cancel/back preserved preparation too.
- Deleting another resume preserved current unsaved editor text.
- Mobile390: document width390; saveBottom652.48 above navTop773. Desktop1440: document width1440. Screenshots visually inspected. No physical phone claim.
- Browser native-dialog tool recovery killed one test tab; reopened with explicit accept policy and repeated the unfinished interaction. This is tooling evidence, not an application failure.
- Final real polish200 preserved participation,30records and the complete negative qualification. Chinese PDF200 rendered as one A4 page; PDFium visual check confirmed legible Chinese/no clipping. A separately created synthetic resume using the corrected projection exported without duplicated education/title facts; old saved prose was not silently rewritten.
- Actual interview start200 with selected resume+saved job; readback200 confirmed saved job title and the resume's negative qualification. See `final-api-2026-10-20.json`.
- Dedicated audit database and private source directory removed by exact name after recording collection counts; original local database and volumes untouched. Own app/browser processes stopped.

## External/unexecuted acceptance

- 3–5 novice students: BLOCKED_EXTERNAL as of 2026-10-21. User plans a new server because of runtime memory requirements; deployment is blocked on ICP filing. Resume acceptance after filing and an accessible acceptance deployment are ready. No humans recruited or fabricated timings/choice counts; this is not a pass.
- Formal teacher/student login: BLOCKED_EXTERNAL. Clerk configuration was absent during the recorded checks; the subsequent deployment decision selects Evren/Resend integration instead (see `docs/DEPLOYMENT_ASSESSMENT.md`). Production authentication remains unverified.
- Physical mobile acceptance: BLOCKED_EXTERNAL as of 2026-10-21, awaiting the same new-server deployment and ICP filing. Desktop mobile-viewport checks do not replace physical-device acceptance. This does not block local feature/layout development or local browser checks.
- Human microphone/speaker quality: user confirmed on 2026-10-20 that this was tested on the preceding Sunday. Accepted as user-reported human verification, not a new assistant-run test. This continuation did not replace capture/playback; deployment HTTPS/device changes may need a focused smoke check.
- Resend delivery/public deployment: intentionally not enabled by this scope.
- Repository not automatically committed/pushed/archived.
