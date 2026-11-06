# CareerSprout campus Docker package

This package runs only `backend/src/campusServer.js` and the configuration-time campus frontend. It does not use the root `docker-compose.yml`, `backend/src/index.js`, legacy Dockerfiles, or local development Compose project. It does not alter local volumes or other Docker workloads.

This is a local package for a possible future authorized release at `https://crayzamb.cloud/career-sprout`; no server change or deployment has occurred. DNS/TLS, proxy ownership, credentials, real auth, capacity, backup/restore, and the public route are not verified.

## Runtime security and routing

- Backend startup requires `APP_PROFILE=campus-local`, `NODE_ENV=production`, `DEPLOYMENT_MODE=container`, `HOST=0.0.0.0`, explicit `DEV_BYPASS_AUTH=false`, matching live Clerk keys, and exact HTTPS frontend URL. MongoDB and Redis URLs are assembled at backend process startup from mounted secret files; startup validation rejects missing credentials and any service host except Compose `mongo`/`redis`. `DB_AUTO_INDEX=true` creates model indexes before Mongo readiness passes.
- Mongo uses an authenticated root bootstrap account and a separate `career_sprout` database user limited to `readWrite` on that database. A Mongo entrypoint shell initializer reads the app password file and passes it only through a child-process environment to `mongosh`; neither secret is placed in mongosh arguments or logs. Redis ACL authentication is enabled; a root startup wrapper copies bind-mounted secret files into a 1 MiB tmpfs, sets Redis ownership/mode, then hands off to the Redis entrypoint. Passwords are not in committed env templates, Compose interpolations/commands, image build arguments, or application logs. A secret file's presence/format does not prove the credential works.
- Frontend receives only the public Clerk publishable key as a build argument. The production campus UI enables both sign-in and public sign-up; configure the production Clerk instance to allow both. Real Clerk session and two-account isolation tests may be recorded as `NOT_RUN` at the user's direction and are not release gates. Production authentication still requires matching real `pk_live_` and `sk_live_` keys: the publishable key is embedded in the frontend build, while the matching `sk_live_` secret remains runtime-only on the backend. Test-format keys must never be used in a production build or runtime.
- Backend port 5002 and both data services are unpublished. Only frontend Nginx binds `127.0.0.1:18082`. Compose gives frontend a fixed private address and Express trusts forwarded identity only from that exact address. Frontend Nginx forwards the supplied X-Forwarded-For value without appending its own untrusted source. The first trusted host Nginx MUST overwrite `X-Forwarded-For` with `$remote_addr`; never use `$proxy_add_x_forwarded_for` here. If that trusted host-Nginx contract cannot be enforced, keep the app route closed; do not enable general proxy trust. This boundary gives rate limiting the real client address only when every stated proxy setting is in force.
- API URL stays `/career-sprout/api/...` at the host and frontend proxy maps it to backend `/api/...`. SPA deep routes fall back to HTML; hashed assets are immutable and HTML revalidates.
- One backend process is required because some resource admission is process-local. Five uniquely named volumes persist MongoDB, Redis, imports (default `~/.career-sprout/imports`), logs (`CAMPUS_LOG_DIR`), and retained hashed frontend assets. The assets volume is append-only across releases so lazy-loaded chunks from open pages remain available; do not delete it during rollback. Stop/down preserve volumes; `down -v`, volume prune, and broad cleanup are prohibited.
- Limits are backend 768 MiB RAM/1536 MiB RAM+swap, Mongo 512/768 MiB, Redis 128/192 MiB, frontend 64/96 MiB; these cap at 1472 MiB aggregate RAM and 2592 MiB RAM+swap and are not reservations. Existing swap is not RAM. No extra swap is configured. Capacity under workload is an external release gate.

## Private configuration and service secrets

In a private build/deployment workspace, copy `deploy/career-sprout/career-sprout.env.example` to `career-sprout.env`, set its Clerk credentials and full source SHA tag, and restrict private files to mode 600. Beside it, create four independent high-entropy secret files: `mongo_root_password`, `mongo_app_password`, `redis_password`, and `redis_backup_password`; create `redis_users.acl` with two lines, replacing each placeholder with the matching Redis password:


```text
user default on >PASSWORD ~api-cache:v1:* ~ai_rl:* +ping +info +get +set +unlink +del +scan +incr +ttl +expire +decr +quit +client|setinfo
user backup on >BACKUP_PASSWORD +ping +save +client|setinfo
```
Create/select the production instance in the Clerk Dashboard, enable the intended sign-in and sign-up methods under **User & authentication**, and retrieve that instance's production `pk_live_` Publishable Key and `sk_live_` Secret Key from **API Keys**. Place the publishable key only in the private build configuration and the secret key only in the private backend runtime configuration. Until both matching live keys are configured, production sign-in and registration cannot function; test-format keys are not substitutes.

The four password values should be independent 64-character lowercase hex strings (`openssl rand -hex 32`), written directly to their mode-600 files without displaying/logging them. Build the Redis ACL file using shell variables read from the two Redis password files, then unset them; never put the values in terminal history. Keep all six private files mode 600 locally. On the target, keep the release directory and private files owned by `ubuntu` (UID 1000): the backend `node` user has UID 1000 and must read its mounted app password; the Mongo initializer reads its credentials as root, and the Redis root wrapper copies its secrets into tmpfs before dropping privileges. Secret files are ignored by Git and must never be sent in the image archive. Compose mounts them only at runtime. The backup account grants only `PING`, `SAVE`, and `CLIENT SETINFO`; use it only for the documented backup. Mongo's first initialization creates the limited application account; do not remove or replace persistent data to make initialization rerun. Rotating credentials on an already initialized volume requires an explicit authenticated rotation operation, not editing secret files alone.

The private env file is used for Clerk server-side secret and public key. Compose services and secret paths are declared explicitly; Compose-expanded configuration must never be recorded, shared, or used as a public artifact because it may expose environment values. The backend secret-key env value remains runtime-only and is not a Vite variable/build arg. Build contexts exclude env files, PEM, Git, data, dependency/cache/test artifacts.
The frontend image receives only the public Clerk publishable key. No DB or Clerk private key goes through frontend build args/assets.
## Off-host immutable image delivery

Build frontend/backend on a trusted off-host Linux Docker workstation, not on the 1.7-GiB target. The release source MUST already be committed; build from a detached worktree of the exact full source commit so image contents cannot diverge from their SHA tag. `PRIVATE_CONFIG` must name a protected directory containing the release's private `career-sprout.env`; do not display or share its values.

```sh
TAG=$(git rev-parse HEAD)
case "$TAG" in (*[!0-9a-f]*|'') echo 'Expected a full lowercase Git SHA' >&2; exit 1;; esac
[ "${#TAG}" -eq 40 ]
BUILD_DIR=$(mktemp -d)
ARTIFACT_DIR=$(mktemp -d)
git worktree add --detach "$BUILD_DIR" "$TAG"
cd "$BUILD_DIR"
set -a
. "$PRIVATE_CONFIG/career-sprout.env"
set +a
unset CLERK_SECRET_KEY
: "${CAREER_SPROUT_RELEASE_TAG:?Set the source SHA in the protected env file}"
test "$CAREER_SPROUT_RELEASE_TAG" = "$TAG"
: "${CLERK_PUBLISHABLE_KEY:?Production Clerk publishable key is required}"
docker build --label "org.opencontainers.image.revision=$TAG" -f backend/Dockerfile.campus -t "career-sprout-campus-backend:$TAG" backend
docker build --label "org.opencontainers.image.revision=$TAG" -f frontend/Dockerfile.campus --build-arg VITE_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_KEY" -t "career-sprout-campus-frontend:$TAG" frontend
test "$(docker image inspect --format '{{ index .Config.Labels "org.career-sprout.clerk-publishable-key" }}' "career-sprout-campus-frontend:$TAG")" = "$CLERK_PUBLISHABLE_KEY"
docker build --label "org.opencontainers.image.revision=$TAG" -f deploy/career-sprout/redis.Dockerfile -t "career-sprout-campus-redis:$TAG" deploy/career-sprout
docker pull mongo:8.0
docker build -f deploy/career-sprout/mongo.Dockerfile --build-arg MONGO_BASE=mongo:8.0 --build-arg SOURCE_REVISION="$TAG" -t "career-sprout-mongo:$TAG" deploy/career-sprout
for image in "career-sprout-campus-backend:$TAG" "career-sprout-campus-frontend:$TAG" "career-sprout-campus-redis:$TAG" "career-sprout-mongo:$TAG"; do
  test "$(docker image inspect --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")" = "$TAG"
done
docker save -o "$ARTIFACT_DIR/career-sprout-$TAG.tar" \
  "career-sprout-campus-backend:$TAG" "career-sprout-campus-frontend:$TAG" \
  "career-sprout-campus-redis:$TAG" "career-sprout-mongo:$TAG"
(cd "$ARTIFACT_DIR" && sha256sum "career-sprout-$TAG.tar" > "career-sprout-archives-$TAG.sha256")
sha256sum deploy/career-sprout/.dockerignore deploy/career-sprout/compose.yml \
  deploy/career-sprout/nginx.conf deploy/career-sprout/mongo-init.sh \
  deploy/career-sprout/mongo.Dockerfile deploy/career-sprout/redis.Dockerfile \
  deploy/career-sprout/redis-entrypoint.sh deploy/career-sprout/career-sprout.env.example \
  > "career-sprout-files-$TAG.sha256"
(
  cd "$PRIVATE_CONFIG"
  umask 077
  sha256sum career-sprout.env mongo_root_password mongo_app_password \
    redis_password redis_backup_password redis_users.acl \
    > "career-sprout-private-files-$TAG.sha256"
)
tar -czf "$ARTIFACT_DIR/career-sprout-config-$TAG.tar.gz" \
  "career-sprout-files-$TAG.sha256" deploy/career-sprout/.dockerignore \
  deploy/career-sprout/compose.yml deploy/career-sprout/nginx.conf \
  deploy/career-sprout/mongo-init.sh deploy/career-sprout/mongo.Dockerfile \
  deploy/career-sprout/redis.Dockerfile deploy/career-sprout/redis-entrypoint.sh \
  deploy/career-sprout/career-sprout.env.example
(cd "$ARTIFACT_DIR" && sha256sum "career-sprout-config-$TAG.tar.gz" >> "career-sprout-archives-$TAG.sha256")
printf 'Release artifacts: %s\n' "$ARTIFACT_DIR"
```

Never build on the target or rebuild under an existing tag. Transfer both archives and `career-sprout-archives-$TAG.sha256`; transfer env/secrets and the private checksum manifest `career-sprout-private-files-$TAG.sha256` only through the approved private channel. Verify archive checksums before extraction, then verify `career-sprout-files-$TAG.sha256` after extraction. Install private files and their manifest under `/opt/career-sprout/releases/$TAG/deploy/career-sprout/`, verify them there with `sha256sum -c career-sprout-private-files-$TAG.sha256`, and retain every prior release's immutable configuration, images, and assets. The build checks that the private env tag equals `$TAG`; the private checksum manifest binds the exact env and runtime credentials used for this release. Compare image tags to the same full source SHA before loading. Compose has no `build:` sections and cannot rebuild implicitly. Do not prune during rollback. Public Clerk publishable key is intentionally embedded in frontend JS/image metadata; it is not a secret. Keep private files out of public artifacts and remove the temporary worktree only after confirming bundles. Never treat an uncommitted tree as a release.

## Future authorized startup (not run)

Only after owner authorization and capacity/proxy/DNS/TLS/backup gates, stage the verified bundles under `/opt/career-sprout/releases/$TAG/` and private files under its `deploy/career-sprout/` subdirectory. Verify all manifests and ownership before loading or starting:

```sh
RELEASE_ROOT="/opt/career-sprout/releases/$TAG"
RELEASE_DIR="$RELEASE_ROOT/deploy/career-sprout"
cd "$RELEASE_ROOT"
sha256sum -c "career-sprout-archives-$TAG.sha256"
tar -xzf "career-sprout-config-$TAG.tar.gz"
sha256sum -c "career-sprout-files-$TAG.sha256"
cd "$RELEASE_DIR"
sha256sum -c "career-sprout-private-files-$TAG.sha256"
sudo docker load -i "$RELEASE_ROOT/career-sprout-$TAG.tar"
sudo docker compose --env-file "$RELEASE_DIR/career-sprout.env" \
  -f "$RELEASE_DIR/compose.yml" config --quiet
sudo docker compose --env-file "$RELEASE_DIR/career-sprout.env" \
  -f "$RELEASE_DIR/compose.yml" up -d
sudo docker compose --env-file "$RELEASE_DIR/career-sprout.env" \
  -f "$RELEASE_DIR/compose.yml" ps
```

Keep the release directory and private files owned by `ubuntu` (UID 1000), mode 600 for private files. No `--build` is used. Startup must fail safely if images are absent, secrets are missing, keys are malformed/mismatched, or dependencies/index creation fail readiness. The initial inventory found Docker requires `sudo`; re-confirm permissions and ensure no existing listener on `127.0.0.1:18082`. Verify exact images and checksums before changing the host Nginx route.

## Host Nginx HTTPS route

Only an authorized owner of the existing TLS virtual host may add this route. Preserve TLS and all existing routes. Crucially, overwrite any attacker-supplied forwarding chain at the first trusted proxy:

```nginx
location = /career-sprout {
    return 308 /career-sprout/;
}
location ^~ /career-sprout/ {
    proxy_pass http://127.0.0.1:18082;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Forwarded-Proto $scheme;
    client_max_body_size 10m;
    proxy_read_timeout 300s;
}
```

Do not expose backend, Mongo, or Redis. Confirm the exact route, TLS, SPA deep link, asset/cache behavior, API health, Clerk callbacks, rate limit client identity, and real auth before enabling public traffic. A configuration snippet is not proof of an installed route.

These are future production-release requirements, not gates for the local disposable smoke in this follow-up. The first trusted host Nginx must overwrite any client-supplied `X-Forwarded-For` with `$remote_addr`; the private frontend proxy intentionally forwards that trusted value unchanged, and Express trusts only the frontend container's fixed address. This design is safe only when the host route enforces that overwrite. The route has not been installed or verified, so keep public access closed until an authorized operator verifies it.

## Production persistence, backup/restore, and rollback

The following backup and rollback requirements apply to a separately authorized production release. The follow-up's isolated backup/restore smoke uses disposable local resources and does not establish a production backup; production backup evidence does not gate this local task.

Never use `down -v`. The uniquely named volumes persist Mongo data, Redis AOF/snapshot data, imports, logs, and retained frontend assets. Each release keeps its own immutable Compose/Nginx/init files and private env beside the release directory. Roll back by running Compose from the prior versioned release directory with that release's env/image tag; stable external volume names preserve data. Do not roll back database contents with application code.

Before release, an operator must execute and validate an encrypted off-host backup on a separate isolated restore target. Back up all five volumes as a consistent set: close ingress and stop only this project's frontend and backend to quiesce writes/seeding; run authenticated Redis `SAVE` as the backup-only user (read its password only from `/run/secrets/redis_backup_password` inside the Redis container; never place the secret in command arguments), copy Redis dump/AOF, Mongo data with authenticated `mongodump` of `career_sprout`, imports/logs, and retained frontend assets; encrypt with an approved off-host key; record source SHA, timestamp, file list, and SHA-256. Resume the project after collection. Restore only into fresh isolated volumes with matching service versions; restore Mongo via authenticated `mongorestore`, Redis data files while Redis is stopped, and imports/logs/assets; verify service health, representative owner-scoped records/files, retained old hashed assets, and controlled app smoke. Never overwrite production or reuse unrelated volume names during proof. No backup or restore has been performed; recovery remains a release gate.

## Verification boundary

- Backend targeted regressions passed 16/16, using `MONGOMS_SYSTEM_BINARY` with system MongoDB 8.0.34. `MongoMemoryServer` requested MongoDB 8.2.6 and emitted a version warning; the targeted tests nevertheless passed. Frontend campus tests passed 74/74, including the signup UI regression.
- Default npm registry requests inside Docker were variable; full frontend `npm ci` and build succeeded using that unchanged registry. The backend install initially failed `ERESOLVE` because its Dockerfile omitted the repository `.npmrc` (`legacy-peer-deps=true`); `backend/Dockerfile.campus` now copies it before `npm ci`, with lockfile and dependencies unchanged. Frontend Dockerfile also skips Puppeteer's redundant browser download (Chromium is supplied by backend) and uses a base-path Nginx config on port 8080.
- Full local frontend image built as `career-sprout-frontend:diagnostic-nondeployable-20261106b`, using a dummy `pk_live_`. It is diagnostic-only, not deployable, and must not be transferred. A bounded loopback HTTP smoke returned 200 for `/career-sprout/`, `/career-sprout/auth`, and a hashed JavaScript asset. Redis image built locally as `career-sprout-redis:local-diag-20261106`.
- Backend image now builds as `career-sprout-backend:local-sjtu-mirror-20261106`, manifest digest `sha256:89fb7b8839ad13a0c89479074e65fa0cbe32237f38083ecce00548354779ac55`, size 573,421,093 bytes. The measured SJTU HTTP source completed apt update/install for 266 packages (~329 MB) in about 83 seconds; APT signature verification remained enabled. The first HTTPS attempt failed because `node:24-bookworm-slim` lacks system CA certificates. The canonical Dockerfile now points Debian Bookworm main/updates and security to SJTU's separate mirror paths. A runtime check confirmed the `node` user, `/app/src/campusServer.js`, Chromium, FFmpeg, and no `.env*` files in `/app`. npm reported 33 dependency advisories (4 moderate, 28 high, 1 critical); no dependency changes were made.
- Mirror probe: same 9,376,124-byte `libicu72` package took 385 ms from SJTU (~24.4 MB/s), 412 ms BFSU, 812 ms USTC, 702 ms LZU, 5.865 s TUNA, and 5.769 s NJU; `deb.debian.org` package fetch timed out at 30s. Bookworm, updates, and security InRelease metadata returned 200 from the tested mirror endpoints. Earlier direct/proxy apt attempts against `deb.debian.org` timed out (900s / 1500s); these were source-network throughput failures, not apt deadlock. Mirror speed is network-location dependent; remeasure if building from another region.
- No server upload/deployment, public route change, commit, or push occurred during the local image-build investigation; no server resources were modified.
- No deployment or server changes occurred. Earlier read-only checks confirmed DNS/TLS for `crayzamb.cloud` and an Nginx 404 at `/career-sprout`; host inventory was inspected without modifying server files, containers, volumes, networks, or routes.
- Real Clerk sessions and two-account isolation are `NOT_RUN` at the user's direction and are not gates for public sign-up/sign-in. Secret-safe inspection found live-format `CLERK_SECRET_KEY` and `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`; the user confirms they belong to the same Production instance. No deployment env or runtime secret files have been installed on the server, so production authentication remains unverified.
