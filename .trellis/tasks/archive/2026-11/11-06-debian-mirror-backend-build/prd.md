# Test Debian mirrors and build backend image

## Goal

Find a reliable, faster Debian package source for the local campus backend Docker build and build the backend image if the measured source supports the complete install. Do not deploy or transfer images.

## Background

- `backend/Dockerfile.campus` installs `chromium`, `ffmpeg`, and `fonts-noto-cjk` from Debian Bookworm; apt resolves 266 packages totaling about 329 MB.
- A direct build timed out after 900 seconds. A retry with explicit HTTP(S) proxy build args timed out after 1500 seconds; apt still fetched from `deb.debian.org`, with the observed index transfer at 25.7 kB/s.
- Official mirror speed tests from Docker host networking found SJTU fastest among the measured complete sources. A 9,376,124-byte package downloaded from SJTU in 385 ms; Bookworm, updates, and separate Debian security InRelease files returned HTTP 200. HTTP sources passed APT's signature checks; HTTPS failed in the slim base because CA certificates are absent.
- The complete apt install succeeded via SJTU in about 83 seconds. A first image attempt then found that the backend Dockerfile omitted `.npmrc`, so `npm ci` rejected the known `cloudinary` peer conflict; copying `.npmrc` before install preserved the existing `legacy-peer-deps=true` policy and enabled the final build.
- User approved testing mirrors, using a fast complete source to proceed with the backend build, and archiving this task when complete.

## Requirements

- Probe several official China Debian mirrors from the same Docker build network, using bounded requests and measuring Bookworm indexes and representative `.deb` throughput. Confirm the mirror has the required Bookworm, updates, security metadata and amd64 packages.
- Select a mirror only when the observed throughput is materially better than the prior baseline and metadata/package downloads validate. If none is demonstrably faster and complete, stop without changing project apt sources and report measurements.
- For a validated fast mirror, use an isolated temporary Dockerfile/source override first, then build the backend image with a unique local diagnostic tag and finite timeout. Keep apt package set and backend behavior unchanged. Do not permanently switch source configuration unless build evidence establishes need and the final source change is minimal.
- Inspect the resulting image metadata/runtime files and ensure no Clerk secret or other credential was added to image config/layers. Never read or print `backend/.env` or other secrets.
- Do not upload, deploy, mutate server resources, commit, or push. Leave the already-built diagnostic frontend image marked non-deployable.
- Update this task and the existing diagnostic/deployment evidence with exact mirror measurements, build result, and limitations. Archive this Trellis task after completion.

## Acceptance Criteria

- [x] Secret-safe measurements compare candidate China mirrors against the observed `deb.debian.org` baseline from Docker build networking.
- [x] Any selected mirror is verified to serve the required Bookworm metadata and representative package artifacts before the full install.
- [x] A fast complete mirror was found; the backend Docker build completed with the unchanged package set and a unique tag.
- [x] Successful backend image metadata and runtime artifacts are inspected; image config has no secret-named environment values and `/app` contains no `.env*` files. Build context excludes secret files; no Clerk/database credential was supplied.
- [x] Task and deployment documentation record observed outcomes; no upload/deployment/commit/push occurred.
- [x] Trellis task is archived after all actionable work and verification are complete.

## Out of Scope

- Upload/deployment or changes to `zgyj_server`, DNS, TLS, or host Nginx.
- Reading or exposing `backend/.env`, Clerk keys, database credentials, npm credentials, or proxy userinfo.
- Unrelated package upgrades, dependency changes, frontend mirror policy changes, or cleanup of unrelated Docker resources.
