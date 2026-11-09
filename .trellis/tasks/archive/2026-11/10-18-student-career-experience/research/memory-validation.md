# Memory-contained verification

User explicitly requires avoid host OOM. Windows host memory remains constrained by unrelated applications; no permission to terminate them. WSL user systemd scopes are available: `systemd-run --user --scope --quiet -p MemoryMax=512M -p MemorySwapMax=256M /bin/true` exited0. This allows per-command finite resident+swap allocation without changing global WSL config or user processes.

Selected verification mode:

- One process scope at a time, entire descendant tree accounted, explicit Node heap and single workers.
- Pure HTTP/unit Node commands96–128MiB heap, no DB/browser, already exercised.
- Isolated Mongo authorization test: MemoryHigh256M / MemoryMax512M / MemorySwapMax512M, Node192MiB, single test concurrency. Exit0 with2 tests passed; real isolated Mongo+HTTP route owner/consent/revision and atomic-answer assertions. Temporary mongod closed by test teardown.
- Frontend focused tests: MemoryHigh256M / MemoryMax640M / MemorySwapMax768M, Node256MiB, Vitest maxWorkers1/no-file-parallelism. Running at record creation; not yet a pass claim.
- MemoryHigh encourages reclaim/swap inside only the test scope; MemoryMax is a final containment boundary, not a target. A limit hit must be reported and diagnosed, not repeated with unlimited memory. Do not combine browser, build and tests.
- Heavy app/browser/PDF proof still deferred until safe measured capacity. Systemwide host pressure is watched continuously; global settings unchanged.

Current default2GiB heavy gate can only be replaced for a contained workload with explicit finite limits and observed low peak; never assume WSL free means host free. No build or browser launched yet.
