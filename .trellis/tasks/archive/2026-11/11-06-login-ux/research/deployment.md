# Authentication frontend deployment — 2026-11-07

## Authorized delivery

User explicitly requested deployment of the local authentication changes after confirming Clerk minimum8. Existing login-ux task continued; no duplicate task. Repository zgyj4532/career-sprout, local branch feat/teacher-portal-career-workspace. Source commit: `e1c6293adbc495720998eaf95e18ccc734f12e5d`. Commit is local and included in the server source.bundle; **not pushed to GitHub**.

25 changed/new task-owned files were generated from actual diff/untracked inventory and checked against staged blobs and the commit tree. Excluded: career-sprout-live-auth.bundle.redacted.js (downloaded diagnostic bundle), docs/evidence/phase1/doctor.json (unrelated machine diagnostic), ignored credentials/build/cache/data. No backend/deploy input changes relative to prior production9946f38b. Existing109 passing regressions reused after proving committed source blobs match tested source; they were not rerun for deployment. Git checkout/archive differences across2476 files were verified to be CRLF/LF only, not content changes.

## Build and integrity

Fresh detached worktree built with canonical frontend/Dockerfile.campus using existing production public key, campus profile, /career-sprout/ basename and registration enabled. Fresh npm ci installed830 packages; Vite554 modules, successful Docker image. No backend private key supplied to build. Public-key Docker name-based secret warnings are not private-key disclosure.

Image: career-sprout-campus-frontend:e1c6293adbc495720998eaf95e18ccc734f12e5d.
Portable image config digest: sha256:d3e317de34ab07342d411e9d3081f495321d92723d1e89a2e8de3fc6aa9b4f8b.
Local containerd manifest-list digest: sha256:2e3aee4859a4e0319e958b3970d0e4d4f58a91adf8bfea593e55499ae3f8675d.
Docker versions expose different Id semantics; target config digest checked against saved archive config, not confused with manifest-list digest.

Exact image startup was exercised locally with real public key and isolated loopback18086; registration deep linkHTTP200; temporary container removed. Server received image archive, full source archive/bundle, source-file manifest, delivery blob manifest, image assets/layers manifest, frontend override and rollout script. All11 artifact checksums passed, all2786 extracted source files passed, bundle HEAD exactly matches source SHA. Target image revision/config digest and complete live frontend file manifest match image. Public HTTPS index plus all JS/CSS files:23/23 SHA256 match image.

Build npm audit reported27 advisories (4 low,7 moderate,15 high,1 critical); no audit fix or dependency-major upgrades applied. This is a release risk disclosure, not a claim that every advisory is runtime-exploitable or newly introduced.

## Rollout and preserved services

Host zgyjserver, VM-0-17-ubuntu. Preflight available RAM997MiB, disk26GiB, existing swap9925MiB available. SSH strict host-key checking used. New release: `/opt/career-sprout/releases/e1c6293adbc495720998eaf95e18ccc734f12e5d/`.

Frontend-only Compose override applied over prior protected config:
`/opt/career-sprout/releases/9946f38b2d434f429e968c7bdaaff9f1d49e4df1/deploy/career-sprout/compose.yml`.
Only frontend recreated with `up -d --no-deps --wait`. Backend/Mongo/Redis IDs and start timestamps were compared equal before/after. No data mutation, schema migration, credential rewrite, proxy change or database restore. Four services healthy. Old frontend image/config and retained hashed assets preserved. Rollout script included automatic frontend-only rollback on failure; it was not triggered.

Rollback (does not delete volumes):
```sh
BASE=/opt/career-sprout/releases/9946f38b2d434f429e968c7bdaaff9f1d49e4df1/deploy/career-sprout
sudo docker compose --env-file "$BASE/career-sprout.env" -f "$BASE/compose.yml" up -d --no-deps --wait --wait-timeout 120 frontend
```
For subsequent startup of this mixed release, include new `frontend.override.yml`; using old base alone intentionally rolls frontend back. Backend/data image tags remain9946f38b.

## Public browser/API evidence

Actual managed Chromium at https://crayzamb.cloud/career-sprout/:
- Anonymous root becomes /career-sprout/login.
- Registration renders one required full-name input, Chinese name/email/password controls and teacher login entry.
- Seven-character synthetic password rejected locally in Chinese; no registration/email/OTP submitted.
- Third-party registration link preserves /career-sprout/login?returnTo=%2Fteacher.
- Desktop1440 and mobile390 surfaces inspected; no horizontal overflow at390.
- Explicit /profile remains its route with401 recovery rather than global redirect.
- API health200; resumes anonymous401 and invalid-bearer401.
- Live public Clerk minimum8, strength enforcement enabled. User's policy change preserved.
- Prebuilt login vendor branding/accessibility English fragments remain; no claim of complete Chinese SDK rendering.
- Managed test tabs closed, synthetic input cleared. No personal account/session/OTP handled.

Production registration/login/OTP/authenticated teacher/logout and the original user's stuck-login incident remain unverified. Frontend deployment and anonymous smoke are complete, not full real-account acceptance. Task stays in_progress.

## Fetch exact deployed source without GitHub push

```sh
scp zgyjserver:/opt/career-sprout/releases/e1c6293adbc495720998eaf95e18ccc734f12e5d/source.bundle ./career-sprout-login.bundle
git fetch ./career-sprout-login.bundle HEAD
git switch --detach e1c6293adbc495720998eaf95e18ccc734f12e5d
```

This report is post-deployment evidence and is not part of the immutable source commit used to build the image.
