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

