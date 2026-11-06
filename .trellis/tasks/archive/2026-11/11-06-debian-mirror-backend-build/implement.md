# Implementation and validation plan

1. Inspect the current backend campus Dockerfile and source definitions without reading `.env`; capture exact distro suites/components/architecture and confirm baseline result from linked diagnostics.
2. Pull/reuse the cached `node:24-bookworm-slim` image. Sequentially probe official China mirror candidates and `deb.debian.org` from a temporary container with the same host-network route as the prior build. Bound each transfer; report status, downloaded bytes and elapsed time, never credentials.
3. Fetch each candidate's Bookworm, updates and security index metadata and validate hashes. Resolve candidate `.deb` URLs from metadata; download a few representative apt package artifacts with checksum validation. Pick the fastest complete mirror only if throughput clearly exceeds prior baseline.
4. If no candidate passes, record evidence and stop without changing apt configuration. If one passes, create a temporary Dockerfile/source override and run the full apt install in a finite, serial build; on success build the campus backend image with a unique diagnostic tag.
5. Inspect successful image metadata and expected runtime tools/files; inspect config/layers for credentials while never reading `.env` or printing secret-bearing material. Record digest and size safely.
6. Update task research, `docs/CAREER_SPROUT_DOCKER_DEPLOYMENT.md`, and `CHANGELOG.md` with measured results and exact completion state; verify no deployment or transfer occurred.
7. Run Trellis quality check if source files changed, otherwise review task/docs consistency. Archive the Trellis task only after actionable work and verification are complete.

## Validation commands

- Bounded network probes/apt download commands in Docker's host-network context; preserve timing/status/byte counts and discard package payloads after checksum validation.
- Bounded `docker buildx build --progress=plain --network=host` with a unique tag for the validated mirror/backend recipe.
- `docker image inspect` on the exact successful tag for ID/size/config metadata; secret-safe image content checks.
- No production Compose, server commands, archive transfer, or public URL smoke.
