# Novice workflow design — pending final approval

## Boundaries and existing evidence

Retain React route-owned state, existing campus API envelopes, Express/Zod/Mongoose and account ownership. No new global store, agent framework or design system. Existing safeguards remain authoritative: import confirmation ledger, revision/contentRevision, tombstones, private screenshot ownership, media cleanup and canonical answer reconciliation. See research/local-flow-audit.md for exact anchors.

Additional inspected contracts: `backend/src/campus/models.js:13-26` owns interests/experiences; `:103-110` owns preparation; `backend/src/campus/growth.js:26-53` combines profile/student reads but writes student data separately. `backend/src/models/UserProfile.model.js:102-109` currently defaults collegeStudent=false; absence cannot therefore be interpreted as an explicit negative. `backend/src/models/Interview.model.js:7-46,73-109` defaults absent scores to0 and lacks a discovery purpose. These need explicit provenance rather than guessing legacy values.

## 1. Surface and navigation

Keep existing warm light surfaces, dark readable text and campus CSS tokens. No new fonts, animation or decorative dashboard. Delete repeated content before introducing disclosure.

| Surface | Default | Secondary | Always visible when relevant |
| --- | --- | --- | --- |
| Home | Returning unfinished work, otherwise import primary and user's interest-conversation entry | Compact existing capability navigation, one optional example | Failed progress load + retry; no invented completion |
| Profile | Current identity/interests and meaningful experience summaries | Edit sections, original/concise variants, optional time/education | Dirty/partial save, AI adoption pending, grants/revoke |
| Resume | Current title/body and save/continue | Import, voice, targeting, list management | Current saved version, dirty state, export limitation |
| Jobs | Selected job summary; interview-origin return action | Browse/manual entry/analysis | Publication scope, unsaved edits, saved-but-return-failed |
| Import | Editable result summary and unresolved decisions | Source text, already reviewed details/history | Destination, conflicts, uncertainty, original retention |
| Preparation | Selected material and direction; start | Mode/count with current values summary | Invalid selection/recovery and save status |
| Answer | Question, one answer editor, save-next | Recording/playback, saved answers | Actual recording state, save unknown, errors |
| Result/history | Available actionable advice; discovery summary/profile confirmation | Scores and per-question details; record management | Scoring basis, legacy label, pending profile confirmation |

Do not unmount components merely to collapse them when they own active recording, ASR review, dirty forms or confirmation state. Use descriptive native controls and stable parent ownership. Keep route-exit warning for unsaved work where affected navigation is changed; never silently convert it into saved state.

## 2. Discovery conversations

Use the existing owned interview/session persistence with an explicit `purpose: interview | discovery` discriminator, not a separate chat stack. Records without purpose are legacy interviews. Keep purpose separate from technical/behavioral/mixed mode; legacy clients must not accidentally request or display scored discovery sessions. New discovery entry can route through existing room UI with purpose-aware rendering.

Persist question IDs and accepted turns. Discovery generates a next question from accepted answers, not a complete static questionnaire: start with a neutral invitation to discuss interests; ask missing identity/major context only when relevant, accepting unknown/nonstudent and avoiding repetitive requests. Keep existing bounded question-count controls/resource admission; allow early end, including a no-answer exit with no fabricated summary. Submitted user text is data, never model instructions governing ownership or writes.

Answer acknowledgement and generation of the next question are separate durable outcomes. A model failure after accepted answer must retain that answer and expose continue-generation, never repost it. Store generated next question before returning it, with a unique session/turn operation and conditional state transition to prevent simultaneous requests advancing twice. No unbounded automatic retries or provider calls. Reuse configured provider/auth/rate-limit behavior; no new vendor.

Discovery never calls numeric interview scoring. End produces grounded conversation summary, concrete expression advice if supported by answers, and structured profile candidates with answer IDs/source excerpts. Validate shape/length and source support; unsupported facts stay absent. Never infer proficiency from interests, or achieved results from plans. Return accessible errors rather than fabricated fallback output.

History lists discovery separately labelled and supports resume/view/delete under the same owner checks. All interview-score aggregators explicitly exclude discovery; inspect all callsites before implementation via LSP. Do not automatically create resumes, teacher grants or public records.

## 3. Profile confirmation and data ownership

After summary show a compact editable candidate card. Ordinary values are included once without per-field checkboxes; user may edit/remove them or choose not to save. Existing conflicting nonempty values require explicit choice. Skip makes no profile writes; session answers still follow existing session retention semantics, not a promise to erase conversation history.

Canonical mapping: explicit university attendance to UserProfile with nullable/known-state provenance; major to education field preserving existing education; interests and confirmed experiences to CampusStudent. Keep plans/ideas explicitly classified and excluded from accomplished-experience/skill evidence in resume rendering, matching and model context. Existing unknown booleans remain unknown for extraction until an explicit source establishes them; do not infer legacy false means user denied being a student.

Do not reuse an upload-only draft by inventing a file. Add a bounded session-derived confirmation record, owner-scoped and unique per conversation/profile confirmation. Freeze reviewed payload, target snapshots/expected values and deterministic IDs before first write. Reuse proven ledger/lease conventions, not a new generic workflow engine. Multi-document Mongo writes are resumable because local Mongo lacks transactions: record actual completed writes, distinguish pre-write conflict from partial completion, and recover only unfinished steps. Guard each target mutation with conditional expected values; all affected ordinary/import/profile writers must participate in the chosen comparison contract so confirmation cannot clobber concurrent editing. Avoid an unrelated blanket data migration.

Repeated confirmation returns the recorded result; it cannot add duplicate interests/experiences or rerun model extraction. Confirmation after user edits rechecks field-level conflicts and does not replay a stale whole profile. Persist source identity with candidates and audit only non-sensitive state/IDs, not full source text in diagnostics. Read fresh data after writes; cache refresh failure is not unsaved data.

## 4. One answer editor and completion recovery

Parent owns the answer text and capture/adoption generation. Refactor voice capture/transcription so shared profile/resume callers retain their existing explicit-adoption behavior, while the interview room inserts completed ASR into its single editor for review. Existing typed content is preserved; insertion appends with a clear boundary rather than replacing. A capture/request ID prevents duplicate append. Cancelling invalidates late responses. Transcription is not answer persistence; only save-next submits.

Preserve `questionId`, owner checks and canonical reads before/after answer POST. Clear text only when canonical accepted answer contains that question. Last-answer CTA first confirms answer, then completes summary. Completion uses durable per-session in-flight admission and recorded result: repeated completed requests return existing result, pending operations report pending, failed generation can be deliberately retried. Never generate another summary merely because the HTTP response was lost. On ambiguous completion read canonical session before attempting another POST. Backend work may need a small session-scoped lease following existing conventions to cover concurrent calls/process exit; bound expiry and distinguish accepted answer from pending summary.

Keep early-end secondary, with explicit unsaved-answer exclusion confirmation. Playback and capture remain mutually gated; stopping/permission/ASR failure offers typing without fake duration/expression data.

## 5. Available-dimension scoring

For new formal interviews persist explicit score version/basis and per-dimension observation status. Missing is null/unavailable, not0; validate numeric bounds and use Number.isFinite, not truthiness. Text confidence describes answer wording, not measured voice/face confidence. Campus does not submit unobserved expression metrics.

For each dimension compute its mean over answers actually observed, retaining observed/answered counts. Overall = round(sum(valid dimension mean * original weight) / sum(valid dimension weights)). Keep original relative weights by interview mode. True0 contributes; no valid dimensions yields null. Persist basis, effective weights and counts with the result so history can explain coverage without recomputing old records. Frontend consumes the canonical aggregate rather than keeping a second zero-filling formula.

Legacy records without the new score version keep their stored values and explicit legacy label, including unfinished legacy sessions completed under their legacy policy. No migration reinterprets old0. Discovery has no score, no default-zero badge and no score statistics. Existing score comparisons must be grouped by compatible version/mode/basis; otherwise show separately rather than averaging incompatible results.

## 6. Save and continue

Route action freezes intended destination and editor revision, saves using current version/owner guards, then navigates with acknowledged resource identity/version. Do not navigate on validation/conflict/network failure. If save outcome is uncertain, reconcile by an operation identifier instead of blind create retry. If save succeeded and navigation failed, reuse saved identity; don't create another resume/job. Existing screenshot saved-job return path is a pattern, not a reason to silently reuse old content. No additional publish/teacher-approval side effects.

## Security and performance checks

No public exposure, auth weakening or new camera requirement. Every discovery/session/confirmation endpoint validates owner; all AI input is untrusted material. Keep quotas, payload limits, bounded turns and model timeouts. Avoid sending complete histories when only bounded context is needed; no background inference or extra model calls for page decoration. No samples/PII in public evidence. Resource lifetime and concurrency checks are required before reporting safe recovery.

## Verification and rollout

See implement.md and research/acceptance-matrix.md. Stable local preview is a prerequisite for UI proof; its prior exit has no established cause. Additive purpose/version/provenance fields preserve legacy reads, but every active caller is migrated with no obsolete UI aliases. Roll back by reverting feature commits while retaining new records; never downgrade readers in a way that scores discovery or overwrites new provenance. No bulk data deletion, no history rewriting. Formal auth/public host readiness and human/device acceptance remain independent blocked release gates.
