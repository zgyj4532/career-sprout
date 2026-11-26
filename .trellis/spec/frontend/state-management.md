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

Profile is one draft owner across `/profile` (no `view`) and the explicit `?view=experiences`, `?view=skills`, and `?view=materials` categories defined by `profileViews.js`. Keep actual departures and unload guarded, and keep import disabled while edits would be overwritten.

`useMobileWorkspaceView()` uses the workspace breakpoint `(max-width: 767px)` and exposes `{ isMobile, mobileView, openMobileView }`. `mobileView` is the recognized `panel` value (or `''` for overview); use `isMobile` to retain desktop rendering. `openMobileView(panel, options)` updates only `panel` (`''` removes it) and supports router `replace`/`state` options. `profileViewDestination(location, view, { clearPanel: true })` clears the prior leaf in the category switch; compose with `mobileWorkspaceViewDestination()` to open a field in a different category in one navigation.

`mobileWorkspaceViews.js` is the guard allowlist for Profile, Jobs, Resume and Interview preparation. Bypass the unsaved-work prompt only if the pathname, hash and all non-view parameters (including repeated values) are unchanged and the requested panel or Profile category actually differs. Both URLs must have a valid view and panel or no panel; unknown, empty or duplicate values and Profile panels belonging to another category do not qualify. Record identity parameters such as `jobId`/`resumeId` are never exempted. Browser Back and Forward use the same check, without releasing unload protection. Cover allowed transitions and refusals in `useUnsavedWork.test.jsx`.

Hide inactive content without remounting ongoing work. Move focus to the destination heading after switching, except when a shared save reveals an invalid control: validate the entire mounted form before writing, switch to the control's view, open enclosing disclosures, and focus/report the field once visible. Do not rely on automatic browser submission validation to focus controls inside hidden content.

Normalize malformed Profile view/panel entries before offering editing: replace with the valid category overview (personal if the category is invalid), retaining unrelated parameters and hash. Do not treat malformed URLs as in-place transitions in the guard. For a confirmed `VALIDATION_FAILED` write response, retain edits and focus the matching mounted field once save controls unlock. Use only `safeValidationDetails()` paths and only when the submitted data matches the rendered draft; preserve generic correction text for non-editable or unmatched paths. Do not treat a validation rejection as an unknown write or replay it automatically.

Resume switches between edit, import, and saved versions using local controls; `/resume?import=1` or an `importId` opens the import view without changing the source editor. Keep all three views mounted. Returning with the Edit control does not reread the record. Explicitly reopening a saved row refreshes a clean editor, but reopening the same row while dirty only returns to the existing draft. Confirm before replacing dirty input with a different record or a blank draft. Completing a record read does not override a newer destination choice. Show in-progress work, pending reviews, and unknown save recovery even from other views, and keep targeted drafts separate from the saved source and its PDF.

The phone Resume tabs can persist the active tab as `location.state.resumeTab` (`edit`, `import`, or `versions`) on the current `/resume` overview entry. The dirty guard allows a router `replace` solely for a recognized tab change with identical pathname, query, hash and remaining state. It does not exempt pushing or popping a tab-only entry, changing record parameters, or writing tab metadata on a leaf URL.

Jobs screenshot review is read-only and uses the editor's `imageDraftId`, not the last import opened in the screenshot workspace. On phones the list's screenshot action pushes `entry=screenshot`; its in-app return pops that entry, while a direct interview handoff removes `entry` by replacement. Keep the handoff parameters/hash and local files. If an intentional same-page navigation temporarily releases the local-files guard, rearm it on the next location key without releasing any other editor's protection.

Mobile Jobs uses `jobId` for saved details, `edit=new` for manual entry, and `panel=requirements|gap` for leaves. Saved-job leaves push from details; an unsaved editor replaces its single history entry so acknowledgement can replace `edit=new` or the screenshot entry with `jobId` without leaving a stale draft behind. Confirmed same-route Back applies even after an unknown outcome; keep the frozen operation and draft available for explicit recovery while Jobs remains mounted, and do not allow another write until recovered. For `VALIDATION_FAILED` under `availability` or `requirements`, keep the safe error visible and offer a correction action that reveals the requirements leaf/disclosure and focuses the mapped field.

Promote a newly acknowledged job to its saved address only while the initiating location still owns the editor. Navigating Back to the list must not let an acknowledged, still-mounted editor overwrite the list URL with its record ID.

Mobile Interview preparation uses `panel=direction|materials|settings` over one account draft. Return pops a panel opened from the overview and replaces a directly entered panel. Start with an empty direction or stale selection opens its visible correction view; a late start response cannot navigate after departure. The overview can recover an unfinished formal session through existing owned history, not another create.
