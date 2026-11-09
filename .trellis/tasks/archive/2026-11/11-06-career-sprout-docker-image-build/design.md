# Docker build diagnostics design

## Scope

Build only local campus images: `frontend/Dockerfile.campus`, `backend/Dockerfile.campus`, and `deploy/career-sprout/redis.Dockerfile`. No upload/deploy, no server changes, no commit/push, no unrelated Docker cleanup. Parent production-release task remains planning; this child isolates the image-build blocker.

## Evidence-first diagnostic path

1. Record command versions, current branch/HEAD and local worktree status, exact Docker builder/driver, buildx version, registry mirror presence, and whether Docker is Docker Desktop or WSL daemon. Do not print proxy values, credentials, or secret-bearing config.
2. Capture a bounded frontend attempt using `docker buildx build --progress=plain` plus Docker CLI/build debug where supported. Instrument npm's actual `npm ci` operation with verbose request/fetch error logging in a temporary diagnostic edit/stage; do not leave noisy logging or altered install behavior in the final image. Keep logs local and scrub proxy URLs/tokens.
3. Test name resolution, TCP/TLS, HTTP status, registry URL and package metadata from the same BuildKit network namespace and proxy path as the failing `RUN`. Compare a direct registry request with npm's configured registry/proxy without exposing credentials. Use bounded timeouts/retries and distinguish a silent fetch/retry stall from lockfile validation, lifecycle script, disk exhaustion, or memory pressure.
4. Diagnose backend apt separately: isolate `apt-get update` versus `apt-get install`, report package/size and transfer progress, test Debian host reachability and proxy behavior inside the build network, and check local builder disk pressure. Do not edit apt sources until evidence identifies the bottleneck.
5. Research official Docker BuildKit proxy/debug, npm proxy/retry/logging, and Debian apt proxy docs; keep linked sources and captured outcomes in the task research log.
6. State one evidence-supported root cause and minimal remediation. Possible remedies are considered only if observed (correctly address the host proxy, bounded fetch settings, or documented package mirror); do not hardcode a registry, upgrade dependencies, alter the lockfile, or weaken `npm ci` by assumption.

## Build and smoke

- Preserve `.npmrc` before `npm ci`; this is required by the existing lockfile and peer resolution policy.
- Use a dummy `pk_live_`-format publishable key only for a local diagnostic frontend image if the real production public key is not available through a safe channel. Tag such image as diagnostic and never transfer/deploy it. A deployable release image needs the real matching production key pair supplied privately.
- Build all image recipes with unique diagnostic tags and finite build time. Verify image inspect/config, filesystem contents and tags. Inspect backend image config/layers for no Clerk secret.
- Run a one-off uniquely named frontend Nginx container on a selected loopback port to verify `/career-sprout/`, a SPA deep route, and hashed assets. Do not run the production Compose file here: its explicit production names/static addresses could collide. The parent release task owns a full multi-service smoke using an override that replaces every production container, volume, network, address, and published port with unique diagnostic values, plus a pinned Mongo image.

## Secret and resource safety

- Never print `.env`, npm config dumps containing tokens, proxy URLs with userinfo, Clerk keys, or Compose-expanded secrets. Record only whether a required variable exists and its prefix class, with values redacted.
- Avoid long unbounded retries. Record start/end, elapsed time, step, exit code, and last observed progress.
- Preserve all existing user Docker resources; use unique names and exact cleanup only.
- No source policy change without evidence and review. Temporary diagnostic modifications are reverted; permanent changes are minimal and reviewed.

## Official references

- Docker Buildx build options: https://docs.docker.com/reference/cli/docker/buildx/build/
- Docker Buildx debug build: https://docs.docker.com/reference/cli/docker/buildx/debug/build
- npm configuration (select the documentation version matching detected npm major): https://docs.npmjs.com/cli/v11/using-npm/config/
- Debian apt HTTP transport and proxy: https://manpages.debian.org/trixie/apt/apt-transport-http.1.en.html
