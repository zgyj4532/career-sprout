# Quality Guidelines

## Verification commands

Run from WSL using the existing Node 24.14.1 runtime and Linux dependencies. Serialize heavy commands; do not run build, full tests and browser/PDF workloads together.

```sh
npm test --prefix frontend -- src/campus --maxWorkers=1 --no-file-parallelism
npm run lint --prefix frontend
VITE_APP_PROFILE=campus-local NODE_OPTIONS=--max-old-space-size=384 npm run build --prefix frontend
```

These are commands to execute, not evidence that they passed. Do not suppress lint rules, force-exit leaking tests, repin incidental text assertions or increase timeouts to manufacture a pass. See `.trellis/spec/project/campus-phase1/verification.md` for cross-layer acceptance and known scope.

## Behavior regressions

Vitest + Testing Library with jsdom; local tests live beside features. Existing examples: `hooks/__tests__`, `components/__tests__`, `pages/__tests__`, `__tests__/api.test.js`. Assert consumer behavior: late responses do not overwrite edits, recording cancellation releases tracks, ownership/version conflict preserves input, duplicate actions do not duplicate records, and unknown values do not become fake successes. Do not test copied strings, source structure, mock forwarding or implementation wiring.

## Actual surface proof

After meaningful UI changes, run the app and exercise changed paths in a real browser. Check narrow and desktop widths, keyboard controls, labels, errors/recovery and source retention. Tests alone do not prove layout, actual model behavior, PDF legibility or MediaRecorder integration. Synthetic media and local development identity are not formal-account/human-device acceptance.

Use existing warm light styling, readable dark headings and labelled semantic metric colors. Never label a suggestion as saved, a failed request as an empty list, or an unobserved external capability as verified. Diagnostics must remain bounded and exclude personal text, screenshots, credentials and raw provider errors.

## Campus code-splitting contract

- Keep Home, shell, session provider, data router and unsaved-work provider eager and stable. Declare lazy pages at module scope, adapting named History exports explicitly. Keep campus/full-app isolation at configuration time; do not change authentication to make bundles smaller.
- Place route Suspense/error handling inside main content, below the guards. Use the exact pending status “第一次打开需要时间，请耐心等待”, centered on both axes with inherited campus typography and theme variables. Keep navigation available; no modal, focus movement or artificial minimum wait. A pathname key may expose pending UI during router transitions, but query/location-key changes and provider rerenders must not remount a healthy editor. Reset errors on navigation only.
- A rejected lazy promise stays rejected: offer usable home navigation and explicit document refresh with a visible unsaved-content warning, preserving unload protection. Never auto-reload, suppress preload errors globally, or advertise boundary reset as a download retry. Optional slogan animation instead retains plain text, remains toggleable and respects reduced motion.
- Measure the production entry's full static import closure, largest chunk, total emitted JS and calculated gzip separately. Check actual production-preview cold/warm requests; development request graphs and gzip estimates do not establish production transfer or latency. Prefer automatic shared extraction; do not raise the 500kB warning threshold, create an all-dependency vendor bucket or prefetch every route.
- Regression coverage must include pending/resolved/rejected imports, navigation while pending, cached revisits, error persistence on rerender, same-path query draft preservation, cancelled dirty navigation and acknowledged continuation. Check deep links and desktop/390px pending and failure surfaces in a real browser. Controlled chunk/API failures prove only the loading boundary, not backend, model or formal-account behavior.
- Release HTML must revalidate (`Cache-Control: no-cache`); content-hashed assets may use long-lived immutable caching. Retain old release assets for open tabs and rollback. Documenting this policy is not evidence of a deployed cache configuration.

The 2026-10-22 integrated run passed 166 campus tests in 28 files, scoped lint and the production build. Under the same local configuration, homepage static JS fell from 625,144 to 384,770 minified bytes (calculated gzip 197,388 to 120,233); total emitted JS increased to 630,595 bytes. Baseline/optimized graphs live in `.trellis/tasks/archive/2026-10/10-21-campus-bundle-loading/`. These are dated measurements, not a permanent byte budget or a server RAM claim.
