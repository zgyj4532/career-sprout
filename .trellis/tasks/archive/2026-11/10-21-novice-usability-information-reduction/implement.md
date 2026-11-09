# Implementation plan — final approval required

## Gate and ownership

This is a plan, not execution authorization. User must approve the final summary after these artifacts. Task remains planning; do not call task start before approval. Existing session pointer is absent; resolve supported session identity using task tooling when activating, without creating a duplicate task or fabricating a context ID.

Use one integration owner for shared session/schema contracts. Treat this task as the parent requirement set; after approval, plan independently verifiable children for (1) discovery/profile confirmation, (2) formal interview/scoring/recovery, (3) page reduction/save-continue, in that dependency order where contracts overlap. Parent owns cross-child acceptance and delivery. Do not create/activate executable children before the approved contracts are available. Preserve prior dirty files and separate previous-stage delivery from this stage; no blanket add/commit of .omp or personal samples.

## 0. Baseline and contract map

- Read scoped frontend specs, project verification, the approved PRD/design, all research, and current working changes.
- LSP references before exported symbols/model consumers change; map interview readers/statistics, profile/import writers, VoiceInput callers, source renderers and save/continue navigation. No product contract is inferred solely from this plan's file list.
- Diagnose local preview exit from recorded process evidence; restore owned loopback runtime without stopping unrelated processes or modifying user data. Capture real desktop/390px baseline with synthetic data before layout edits.
- Inventory existing behavior tests; preserve relevant consumers, remove tautological/source/wording tests if encountered rather than re-pinning them. Establish fault scenarios before fixing completion response loss.

## 1. Discovery and profile confirmation (R11–R15, AC5–AC7)

- Extend owned session contract with purpose and persisted adaptive next-turn generation; unknown legacy purpose remains interview. Update schema, routes, client API and history consumers together.
- Keep neutral first question, contextual follow-up, known/unknown identity and bounded conversation. No scoring or fabricated summary for zero answers.
- Implement grounded candidate extraction with source IDs, explicit idea/in-progress/completed distinction and no automatic skill/identity inference.
- Implement durable reviewed confirmation, target comparisons, recovery and idempotent writes across UserProfile/CampusStudent. Inspect existing import ledger helpers and reuse only valid conventions; never fabricate upload records.
- Migrate ordinary profile/import writes and downstream material/matching projections needed for truthful idea and unknown identity handling.
- Wire empty-material entry, single answer editor reuse, summary and one editable confirmation card; skipping must not mutate profile.

## 2. Formal interview and scoring (R7–R10, AC2–AC4)

- Refactor capture/transcription integration for one interview answer editor while migrating profile/resume VoiceInput callers without dropping explicit adoption protections.
- Preserve answer CAS/reconciliation; final save transitions to summary only after accepted answer. Reproduce ambiguous completion then add durable admission/reconciliation and one recovery action.
- Introduce versioned available-dimension scores, null missing values, canonical aggregates/coverage, old-policy labels and compatible comparison grouping. Review all model defaults and projections rather than fixing only the UI.
- Preparation reuses valid existing choices and recent saved resume where no choice exists, with explicit visible selection and unavailable-source recovery. No auto-start.

## 3. Page reduction and save-continue (R1–R6, R16, AC1/AC8)

- Home: one current next action, exact user-approved interest entry, compact capability access; no repeated path/portal instructions.
- Profile/resume: primary current material editing, secondary tools on demand, source/alternative text not duplicated by default; do not hide conflicts/save state or unmount live edits/media.
- Jobs/import: contextual save/return, result-first review and selected-source summary; preserve private/public scope and non-equivalent close/discard/retry actions.
- Implement save-continue against acknowledged new identity/version, reconcile unknown saves, retain editor on failure, reuse saved identity when navigation fails.
- Report/history: useful next advice first, scores/turns secondary; separate discovery and legacy scoring; distinct loading/error/empty states and accessible management.
- Retain existing CSS/token conventions and branded surface; no unrelated visual overhaul or unnecessary dependency.

## 4. One integrated quality pass and smoke proof

Agents must skip builds/lint/tests/formatters mid-flight. After integrated edits, run applicable commands once, fix actual failures and rerun affected paths only:

- `npm run test:campus --prefix backend`
- `npm test --prefix frontend -- src/campus --maxWorkers=1 --no-file-parallelism`
- Target existing backend schema/interview suites discovered in phase0 for shared legacy contracts; do not claim campus-only tests cover all changed callers.
- Scoped frontend/backend lint for changed active files. Do not rerun known unrelated dormant-backend lint failures merely to confirm them.
- In WSL Node24: `VITE_APP_PROFILE=campus-local NODE_OPTIONS=--max-old-space-size=384 npm run build --prefix frontend`.

Use deterministic behavior regressions for plausible consumer bugs: duplicate turns/confirmation, conflict vs partial writes, real0/null, legacy score preservation, purpose segregation, late ASR and wrong-owner requests. Do not add tests for copy strings, component wiring or nonempty output.

Actual proof in isolated synthetic account/database, not only tests:
1. No material -> discovery -> contextual follow-up -> end -> edit candidate -> skip/no profile mutation -> explicit save -> refresh and normal profile edit preserves fields/ideas. One fresh real configured-model run, with evidence separated from controlled failures; do not spend repeated calls to conceal failures.
2. Resume/experience -> preparation -> screenshot detour/cancel/return -> formal interview -> type/controlled audio -> same answer editor -> save/next -> last save/report. Do not claim human audio or physical phone proof from controlled tracks.
3. Lose response after accepted answer, after generated next turn, after complete and after profile confirmation. Resume canonical state without duplicate records/model operations; partial profile write and concurrent edit conflict preserve newer data.
4. New score records: true0, partial/full missing, no expression; legacy record remains unchanged; discovery absent from score averages and shown without numerical assessment.
5. Edit resume/job -> save-continue; failed save retains text, successful save/failed return continues without new create, private scope unchanged.
6. Real screenshots at desktop/390px, keyboard traversal, disclosed content/focus/save bar, loading/empty/error and first/returning states. Compare density by actual visible repeated sections/actions, not invented percentage improvement.

Remove owned temporary fixtures/harnesses and stop only owned runtime/browser processes after smoke. Preserve original data/volumes. Record commands, outputs, model use, screenshots safe for publication and remaining limitations. Update existing specs/docs/changelog for permanent behavior and reconcile Issue #1 checkboxes only to exercised scope. No student or physical-device acceptance claim until filing/deployment blockers clear.

## Delivery and archive

Each independently verified child can be committed and reviewed with exact scope; reference issue/PR/commit in task metadata. Parent remains open until cross-child acceptance is satisfied. User has not authorized automatic push/PR/merge in this planning turn; follow approved release workflow when implementation is delivered. Do not mark external blocked criteria passed or archive the full task merely on a local green run.

## Rollback

Keep old persisted data readable; disable new entry before reverting consumers if needed. Preserve discovery purpose, score version and confirmation records so rollback cannot treat discovery as scored interviews or replay writes. Avoid destructive down-migrations. If model/storage changes cannot safely roll back with retained data, stop and document explicit recovery instead of deleting records.
