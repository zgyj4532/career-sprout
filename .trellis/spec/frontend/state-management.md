# State Management

## Current campus model

Campus pages use `useState` for form/UI state, `useRef` for request generations and `useEffect` for loading/cleanup. Authentication capability is shared by `CampusSessionProvider` / `useCampusSession` in `auth.jsx`. The upstream project has Zustand, but campus pages do not require a global store; do not add one just for a form.

Examples: `JobsPage.jsx` owns selected job, dirty flag, suggestions and errors; `ResumePage.jsx` separates saved records from its editor; `useAudioCapture.js` owns async media resources outside rendered state.

## Server versus draft

Server data is authoritative for ownership, persisted versions, deletion and completed work. Input state is authoritative for unsaved text. A successful list reload must not discard a dirty editor. AI adoption changes input only; save acknowledgement changes saved state. If a request times out, distinguish unknown save outcome from a confirmed failure before retrying.

```js
const version = revision.current
const suggestion = await loadSuggestion()
if (version === revision.current) setSuggestion(suggestion)
```

Increment the revision on relevant user edits, material replacement and unmount. Invalidate stale AI suggestions. A busy boolean prevents ordinary repeat clicks but is not an idempotency guarantee; the backend must enforce that invariant.

Durable cross-page preparation/import state belongs to the authenticated account, not an unscoped browser key. Do not store full sensitive material, keys or tokens in diagnostics. Keep loading, failure, genuine empty and saved states distinguishable. Optional unknown values remain null/empty where their API contract allows them.

## Novice material continuation

`saveOperation.js` freezes the operation ID, payload, expected version and intended destination before a resume/job write. A transport/server uncertainty first reads the owned save-operation record. Only `SAVE_NOT_FOUND` permits replaying that same operation; a failed recovery read never authorizes a new create. Keep the editor locked with visible recovery while the outcome is unknown. On acknowledgement retain the returned resource/version and reuse it if navigation fails; do not fetch a speculative newer resource and call that the saved version.

Profile saves first read uncached canonical `/me`, compare each editable field against the loaded baseline, retain unrelated remote changes, and require explicit choice for same-field conflicts. Send each target's fresh `expectedUpdatedAt`; skip writes whose reviewed fields already equal canonical state. A lost response triggers canonical reconciliation without replacing local inputs, and retry rechecks only unfinished changes. `profileSave.js` owns these projections, including explicit nullable attendance so unchanged studyStage cannot re-infer it. Discovery experience state/source IDs survive ordinary editing; ideas are excluded by default from resume materialText, while `{includeIdeas:true}` labels them for practice. Missing legacy state remains completed, never infer achievement from a plan.

Optional native disclosures or `hidden` containers retain component ownership. Active recording, pending review, dirty state, save recovery, grant revocation and version warnings remain visible outside optional controls. CampusApp uses the data router with one `UnsavedWorkProvider`/`useBlocker` to aggregate dirty editors and protect link, imperative, Back and Forward transitions. `useUnsavedWork` also protects document unload/external links. Its returned `allowLeave()` removes only that editor's guard synchronously after server acknowledgement (or explicit discard), allowing save-and-continue without bypassing other dirty editors. Do not implement manual history rewinds or popstate loops.
