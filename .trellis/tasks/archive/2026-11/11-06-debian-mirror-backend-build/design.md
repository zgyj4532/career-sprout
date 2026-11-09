# Debian mirror measurement and backend build design

## Scope and boundaries

Measure official China mirrors from Docker's host-network build context, then build only the campus backend image if one mirror is both faster and complete. Reuse prior frontend/Redis results; no server activity, release archive, commit, push, or unrelated Docker cleanup. Never inspect or print secret files.

## Measurement design

1. Inspect `backend/Dockerfile.campus` and the cached `node:24-bookworm-slim` base to learn exact Debian source definitions, architecture, suite/components, and required packages.
2. Use bounded, sequential HTTP probes from a disposable host-network container or equivalent BuildKit `RUN` context. For each official China mirror, verify `InRelease` and required `bookworm`, `bookworm-updates`, and `bookworm-security` metadata are present and readable. Record time-to-first-byte, total bytes, elapsed time, and status only.
3. Measure at least one index and representative `.deb` artifacts against `deb.debian.org`; use apt metadata to select actual package URLs and validate expected content hashes. Do not compare only DNS or a single tiny HTTP response. Avoid overlapping large package downloads.
4. A mirror is eligible only when metadata is consistent, package artifacts validate, and measured sustained throughput is materially above the prior 25.7 kB/s index baseline. If candidates are equivalent, invalid, or slower, stop and report; do not change apt sources.

## Build path

- First build via an isolated temporary Dockerfile copy/source replacement to verify full `apt-get update/install` without changing repository source policy.
- If the full install succeeds, build the actual campus backend using the validated mirror with a unique diagnostic tag and finite timeout. Keep package versions and installed package set unchanged.
- Consider a permanent Dockerfile source change only if needed for reproducible success and supported by measured evidence; keep it small and document mirror maintenance/fallback implications.
- Inspect image ID, size, configured entrypoint/user and expected Chromium/FFmpeg/font artifacts. Check config values and layer contents for forbidden auth/database secrets without printing secret content. Do not read env files.

## Risks and rollback

- Public mirrors can be stale, rate-limited, filtered, or inconsistent between main/security/updates; verify all three suites and package hashes before using one.
- A one-file benchmark can mislead; include index and real package downloads, then validate the actual apt transaction.
- Temporary diagnostic source edits remain outside tracked project files and are discarded. If a project Dockerfile change is necessary, it is limited to apt mirror configuration, and reverting it restores the previous behavior.
- Every probe/build has a finite timeout; never leave overlapping apt builds running.

## External reference

- Debian official mirror directory: https://www.debian.org/mirror/list
- Debian Bookworm apt HTTP transport: https://manpages.debian.org/bookworm/apt/apt-transport-http.1.en.html
