# Debian mirror benchmark and backend image build

## Environment and method

- Date: 2026-11-06. Docker Buildx `docker` driver, BuildKit v0.32.2, linux/amd64; cached base `node:24-bookworm-slim`.
- Sequential HTTPS probes ran in a disposable `node:24-bookworm-slim` container with `--network=host`. Each candidate fetched the same Bookworm `InRelease` and `libicu72_72.1-3+deb12u1_amd64.deb` (9,376,124 bytes), with 30-second per-request bound.
- Apt source suite check fetched Bookworm, Bookworm Updates, and Bookworm Security `InRelease`; security mirrors use the separate `/debian-security` path.

## Measurements

| Source | 9,376,124-byte package | InRelease / suite coverage |
|---|---:|---|
| `deb.debian.org/debian` | timed out at 30s | Bookworm 200 |
| `mirror.sjtu.edu.cn/debian` | 385 ms (~24.4 MB/s) | Bookworm, updates 200; security via `/debian-security` 200 |
| `mirrors.bfsu.edu.cn/debian` | 412 ms (~22.8 MB/s) | Bookworm, updates 200; security via `/debian-security` 200 |
| `mirrors.ustc.edu.cn/debian` | 812 ms (~11.5 MB/s) | Bookworm, updates 200; security via `/debian-security` 200 |
| `mirror.lzu.edu.cn/debian` | 702 ms (~13.4 MB/s) | Not separately validated for every suite |
| `mirrors.tuna.tsinghua.edu.cn/debian` | 5,865 ms (~1.6 MB/s) | Bookworm, updates 200; security via `/debian-security` 200 |
| `mirror.nju.edu.cn/debian` | 5,769 ms (~1.6 MB/s) | Not separately validated for every suite |
| `ftp.cn.debian.org/debian` | TLS request failed | Not selected |

HTTPS worked from the Windows/WSL Node host but APT HTTPS failed inside the slim base because it has no system CA certificates. The final recipe uses HTTP for these Debian mirrors; Debian's `Signed-By` keyring and APT signed-index/hash verification remain enabled. No insecure APT options were added.

## Build outcomes

1. Previous direct `deb.debian.org` apt build: 900-second timeout; 9.4 MB index fetch in 51 seconds, package set resolved to 266 packages / ~329 MB.
2. Previous explicit HTTP(S) proxy args to `deb.debian.org`: 1,500-second timeout; index fetch measured 25.7 kB/s and package 149/266 was in progress. Proxy args did not fix sustained throughput.
3. Temporary SJTU HTTPS Dockerfile: apt rejected TLS because base image lacks trusted CA certificates; subsequent package lookup failed. No security bypass used.
4. Temporary SJTU HTTP Dockerfile: `apt-get update` and installation of all 266 packages / ~329 MB succeeded in ~83 seconds. The following `npm ci` failed with `ERESOLVE` because `backend/.npmrc` was not copied into the image; the repository setting `legacy-peer-deps=true` is required for the checked-in lockfile (`multer-storage-cloudinary@4.0.0` peer range versus `cloudinary@2.10.0`).
5. Minimal source fix: copy `.npmrc` before backend `npm ci`, and rewrite only Debian Bookworm main/updates/security URLs to the measured SJTU endpoints over HTTP. Package list, lockfile, and versions unchanged.
6. Canonical build passed with `backend/Dockerfile.campus`: `career-sprout-backend:local-sjtu-mirror-20261106`. Docker manifest digest `sha256:89fb7b8839ad13a0c89479074e65fa0cbe32237f38083ecce00548354779ac55`; image size 573,421,093 bytes. `npm ci` installed 487 packages in 54 seconds. npm reported 33 advisories (4 moderate, 28 high, 1 critical); dependencies were not changed.
7. Image inspection showed user `node`, entrypoint `docker-entrypoint.sh`, command `node src/campusServer.js`, exposed `5002/tcp`, and only non-secret environment fields. Isolated `--network=none` runtime inspection confirmed `/app/src/campusServer.js`, executable Chromium and FFmpeg, and zero `.env*` files in `/app`. No Clerk/database credentials were passed to the build. The image was not started as an application because runtime service credentials/database are intentionally absent.

## Boundaries

- No upload, deployment, server mutation, commit, or push.
- The Dockerfile's mirror choice is based on this build network's measurements; mirror throughput is location-dependent and should be remeasured before builds from another region.
- The diagnostic frontend image still contains a fake Clerk publishable key and must not be deployed or transferred.

## Sources

- Debian official mirror directory: https://www.debian.org/mirror/list
- Debian Bookworm apt HTTP transport and proxy configuration: https://manpages.debian.org/bookworm/apt/apt-transport-http.1.en.html
