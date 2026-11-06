# Implementation and verification plan

1. Read current task and parent release scope; inspect current Dockerfiles, `.npmrc`, `.dockerignore`, compose config, build history, and exact builder. Record relevant source revision and user worktree state without revealing environment values.
2. Read the official Docker Buildx, npm configuration, and Debian apt proxy documentation listed in `design.md`; detect `npm --version` inside the Node 24 build image first and use the matching official npm CLI documentation version. Record supported debug/proxy controls and avoid unsupported flags.
3. Reproduce the frontend build with a unique diagnostic tag and bounded duration. Use plain BuildKit progress and supported debug mode. Add temporary npm verbose/error logging around `npm ci`; capture stdout/stderr and timestamps, redact credentials, then classify the last operation as DNS, TCP/TLS, HTTP/registry, npm retry, lifecycle, disk or memory.
4. Test the exact registry/proxy route from the same build network with short bounded probes. Compare registry metadata reachability and npm's effective registry/proxy behavior without printing config secrets. Record proxy hostname/port only if safe; never log credentials or raw proxy URI.
5. Diagnose backend apt in a separate bounded build, splitting update/install only in a temporary diagnostic copy if needed. Record slow package/fetch and apt proxy behavior. Check builder disk/resource pressure read-only. Do not run both large downloads simultaneously.
6. Write a concise root-cause analysis to this task's `research/docker-build-diagnosis.md`, including command/exit/elapsed evidence, official citations, remaining uncertainty, and a minimal fix sequence. If evidence does not distinguish a cause, do not declare one; ask only for the missing operational input after repository and network probes are exhausted.
7. Apply the minimal evidence-based build fix. Keep `frontend/.npmrc` copied before `npm ci`; preserve package lock/dependency graph and production fail-closed Docker requirements. Remove temporary instrumentation before final build unless a permanent non-secret diagnostic is justified by evidence.
8. Build frontend/backend/Redis images serially with unique tags and finite timeout. Frontend diagnostics may use a dummy public key only for a clearly marked non-deployable image; do not transfer it. Do not build a deployable image until the matching `pk_live_` is privately available. Verify image metadata/tag and inspect the backend for secret leakage.
9. If the frontend image builds, run only a one-off uniquely named Nginx container bound to a chosen loopback port. Verify `/career-sprout/`, an SPA deep route, and hashed assets; pass only the matching dummy key to the diagnostic container, then remove that exact container. Do not run the production Compose file in this child task.
10. Full multi-service Compose smoke remains in the parent production-release task. Before that smoke, create a temporary Compose override replacing every explicit `container_name`, volume `name`, network `name`/static address, and host-published port with unique diagnostic values. Pull/tag the exact pinned Mongo base image required by `pull_policy: never`, verify the rendered Compose config contains no production resource names/ports/subnet, then use a unique project name and remove only those exact resources.
11. Update `docs/CAREER_SPROUT_DOCKER_DEPLOYMENT.md`, `CHANGELOG.md`, and this task's research record with actual success/failure evidence. Keep deployment/server status explicitly unchanged and do not claim production release.

## Verification commands

- Bounded `docker buildx build --progress=plain` with documented debug option supported by installed version.
- Targeted container network probes for registry/apt connectivity, with timeouts and secret-redacted output.
- Image inspect plus exact digest/tag and file/config checks; ensure backend image has no Clerk secret.
- One-off frontend container HTTP smoke for `/career-sprout/`, SPA deep route and hashed assets, using only a unique task-owned container/loopback port and exact cleanup. Full Compose smoke is assigned to the parent task and must use an isolated override.

## Rollback

- Revert temporary diagnostic Dockerfile/scripts/config changes after recording evidence.
- If permanent source changes are made and the build still fails, keep them scoped to the root cause; no broad dependency upgrades or package mirror policy changes.
- Stop/remove only resources named by this task. Never touch server resources or unrelated containers/volumes.
