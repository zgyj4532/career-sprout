# Evidence and scope map

## Observed local gaps
- scripts/local/verify-phase1.mjs:16-25 runs old backend npm test and whole frontend checks, no explicit campus profile or smoke, child executables follow PATH rather than current Node.
- scripts/local/doctor.mjs:20-45 reports tool versions/config presence, but only prints ports; Compose, actual occupancy and ASR diagnostics absent.
- scripts/local/smoke-phase1.mjs:65-80 creates a resume in default local identity/database and retains ID; :102-123 assumes missing AI key. Never call unchanged as a safe current smoke.
- scripts/local/check-persist.mjs:1-2 hardcodes historical ID/marker; does not orchestrate a restart itself.
- docs/PHASE1_REPORT.md retains dated2026-10-15 observations, old path/HEAD/missing AI conditions. docs/PHASE1_1_REPORT.md already contains later real model/ASR results; incorporate rather than duplicate or erase history.
- README and docs/MANUAL_ACCEPTANCE,DEPLOYMENT_ASSESSMENT,SERVER_CONFIG still state Evren/Resend selected. User now explicitly chooses Clerk. Old task10-20 notes also need current-decision pointer; archived evidence remains historical, not rewritten.
- Latest browser evidence primarily390/1440; original360/768 evidence is old. Need current key-page360/768 captures with synthetic data and real surface interactions.

## External references read
Pinned upstream README: https://cdn.jsdelivr.net/gh/anurag3407/career-pilot@0f0be2c176b3dd08ba8a574b75a6c9003ce86c61/README.md (raw GitHub timed out). Structure: centered name/tagline/links, introduction, workflow, screenshots, feature pillars, quick install, documentation/license. Borrow hierarchy, not length, Firebase statements, old5000 ports, or full-platform capabilities.
Clerk official existing-project guidance: https://clerk.com/docs/react/getting-started/quickstart . Existing Clerk projects skip init; preserve installed SDK generation. Do not create replacement app, overwrite keys or upgrade SDK solely because new docs differ. This is reference content, not permission to provision external accounts.

## Safety constraints
No dormant-module deletion, no npm audit fix/upgrade, no original DB resets, no non-loopback bypass, no public deployment, no credential printing. Full upstream checks may fail independently; retain failures visibly without making campus summary imply whole-repo success. External authentication/user/device acceptance stays separate.
