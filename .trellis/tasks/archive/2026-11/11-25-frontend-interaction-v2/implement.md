# Implementation sequence — after explicit approval only

1. Capture desktop and mobile before images and the baseline draft/Back/import behavior using synthetic local data. Check the existing 767/768px boundary as well as reference widths.
2. Build Profile first: two URL-addressable views controlled by one page owner. Verify forward/back, focus, tabbing, pending import recovery, dirty edit preservation inside Profile and guard on leaving. Keep class and consent actions discoverable and separate; test that an attempted import cannot overwrite a dirty edit.
3. Adjust the desktop rail and existing mobile bottom navigation. Validate main/history/account direct links, loading boundary and cancelled navigation. Keep Home, auth and focused room outside the shell cutover.
4. Migrate Resume: one editor, named import and version entries, AI review, save/continue and PDF. Check deep links and record-switch confirmation without remounting draft state. Validate after this slice before moving on.
5. Migrate Jobs and Interview independently. Preserve job pagination/return, selection, screenshot recovery and cross-page handoffs. Verify question/answer, voice review, cancellation, confirm-before-advance and result state. Remove only CSS rendered obsolete by these cutovers.
6. Compare browser captures at 320/390/768/1024/1440 CSS px, including mobile portrait and landscape. Exercise long content, error and recovery states, touch/control size, focus visibility, safe-area padding, software keyboard and navigation occlusion, browser Back, and cross-page flow. Include real iOS Safari and Android Chrome where available for keyboard, sticky UI and media; report unavailable devices as unverified, not covered by simulated viewport evidence.

## Verification
In WSL on the repository's pinned Node runtime, run serially:

```sh
npm test --prefix frontend -- src/campus --maxWorkers=1 --no-file-parallelism
npm run lint --prefix frontend
VITE_APP_PROFILE=campus-local NODE_OPTIONS=--max-old-space-size=384 npm run build --prefix frontend
```

Report pre-existing upstream lint failures separately, without suppressing them. Use the manual campus acceptance guide for real-browser checks. Keep each cutover revertible without API or data changes. No commands in this checklist are represented as executed during planning.
