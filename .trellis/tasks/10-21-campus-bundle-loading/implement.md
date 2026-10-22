# Implementation sequence — awaiting final approval

1. After user approval start this existing task; read frontend component/state/hook/quality specs. Preserve all dirty work. Capture current built HTML/JS cold-load requests in production preview before edits; baseline.json already records actual production graph. No full app dependency upgrades.
2. Add route-local loading/error behavior and module-level lazy imports for non-home pages. Keep data router, auth and unsaved-work provider stable. Adapt named History exports without changing public consumer contract.
3. Defer BlurText/Motion until click, native reduced-motion subscription and text fallback. Verify failure does not block phrase toggle and no deferred work after unmount.
4. Measure resulting build; prefer automatic chunks. Only add justified manual chunks if actual sizes require them; never increase threshold. Record static closure rather than only entry file.
5. Run targeted behavior regressions for pending/rejected route import, dirty navigation cancel, successful save continuation, deep links and animation/reduced-motion state. Existing campus suite, scoped lint and production384MiB build run serially after integration. Avoid source/wording assertions or assertions that only count files.
6. Serve actual production dist on loopback; cold and warm browser routes, network JS timing, slow chunk and deliberate missing chunk, explicit recovery, keyboard status, asset base. Real backend or clearly labelled controlled API data can isolate loading tests; do not claim API/model correctness from fixtures. No human/mobile claim.
7. Update README/CHANGELOG and scoped specs with measured results and deployment cache requirements. Remove measurement/preview harnesses, retain JSON evidence. No automatic commit/push/archive; parent local functionality and external blockers unchanged.

Final planning approval is required before source implementation. Target per-chunk<500kB and smaller homepage closure; if achieving it requires a material behavior change, return to planning rather than hiding warning.
