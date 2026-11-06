# CareerSprout release source inventory

This inventory snapshots the source delivery from base `463e7d6b3962bb22d8bb3cbb5efa0455c7227907` through release commit `9946f38b2d434f429e968c7bdaaff9f1d49e4df1`. The source commit is local-only; no push was authorized. The public deployment config was packaged from this commit; the image layers were reused from the prior build only after verifying their inputs and filesystem content were unchanged.

## Include: runtime, regression coverage, deployment package, and documentation

The inventory contains 71 changed paths (including deletion of the prior `mongo-init.js` and addition of `mongo-init.sh`). The prior 69-path commit is superseded for release by follow-ups that isolate the Mongo image build context and correct its init script.

- `.gitignore`
- `CHANGELOG.md`
- `.trellis/spec/project/campus-phase1/wsl-local.md`
- `backend/.dockerignore`
- `backend/Dockerfile.campus`
- `backend/src/campus/__tests__/campusIsolation.test.js`
- `backend/src/campusServer.js`
- `backend/src/config/__tests__/databaseReadiness.test.js`
- `backend/src/config/__tests__/localDevIdentity.test.js`
- `backend/src/config/database.js`
- `backend/src/config/localDevIdentity.js`
- `backend/src/middleware/auth.js`
- `backend/src/productionSecrets.js`
- `deploy/career-sprout/career-sprout.env.example`
- `deploy/career-sprout/.dockerignore`
- `deploy/career-sprout/compose.yml`
- `deploy/career-sprout/mongo-init.sh`
- `deploy/career-sprout/mongo-init.js`
- `deploy/career-sprout/mongo.Dockerfile`
- `deploy/career-sprout/nginx.conf`
- `deploy/career-sprout/redis-entrypoint.sh`
- `deploy/career-sprout/redis.Dockerfile`
- `docs/CAREER_SPROUT_DOCKER_DEPLOYMENT.md`
- `frontend/.dockerignore`
- `frontend/Dockerfile.campus`
- `frontend/index.html`
- `frontend/nginx.conf`
- `frontend/retain-career-sprout-assets.sh`
- `frontend/src/campus/CampusApp.jsx`
- `frontend/src/campus/__tests__/api.test.js`
- `frontend/src/campus/__tests__/auth.test.jsx`
- `frontend/src/campus/api.js`
- `frontend/src/campus/auth.jsx`
- `frontend/src/campus/pages/AuthPage.jsx`
- `frontend/src/campus/pages/__tests__/ResumePage.test.jsx`
- `frontend/src/main.jsx`
- `frontend/verify-clerk-publishable-key.sh`
- `frontend/vite.config.js`

## Include: Trellis task records supporting this release

- `.trellis/tasks/11-04-career-sprout-docker-deploy-followup/check.jsonl`
- `.trellis/tasks/11-04-career-sprout-docker-deploy-followup/design.md`
- `.trellis/tasks/11-04-career-sprout-docker-deploy-followup/implement.jsonl`
- `.trellis/tasks/11-04-career-sprout-docker-deploy-followup/implement.md`
- `.trellis/tasks/11-04-career-sprout-docker-deploy-followup/prd.md`
- `.trellis/tasks/11-04-career-sprout-docker-deploy-followup/task.json`
- `.trellis/tasks/11-04-docker-deploy-career-sprout/check.jsonl`
- `.trellis/tasks/11-04-docker-deploy-career-sprout/design.md`
- `.trellis/tasks/11-04-docker-deploy-career-sprout/implement.jsonl`
- `.trellis/tasks/11-04-docker-deploy-career-sprout/implement.md`
- `.trellis/tasks/11-04-docker-deploy-career-sprout/prd.md`
- `.trellis/tasks/11-04-docker-deploy-career-sprout/task.json`
- `.trellis/tasks/11-06-career-sprout-docker-image-build/check.jsonl`
- `.trellis/tasks/11-06-career-sprout-docker-image-build/design.md`
- `.trellis/tasks/11-06-career-sprout-docker-image-build/implement.jsonl`
- `.trellis/tasks/11-06-career-sprout-docker-image-build/implement.md`
- `.trellis/tasks/11-06-career-sprout-docker-image-build/prd.md`
- `.trellis/tasks/11-06-career-sprout-docker-image-build/research/docker-build-diagnosis.md`
- `.trellis/tasks/11-06-career-sprout-docker-image-build/task.json`
- `.trellis/tasks/11-06-career-sprout-production-release/check.jsonl`
- `.trellis/tasks/11-06-career-sprout-production-release/design.md`
- `.trellis/tasks/11-06-career-sprout-production-release/implement.jsonl`
- `.trellis/tasks/11-06-career-sprout-production-release/implement.md`
- `.trellis/tasks/11-06-career-sprout-production-release/prd.md`
- `.trellis/tasks/11-06-career-sprout-production-release/task.json`
- `.trellis/tasks/11-06-career-sprout-production-release/release-inventory.md`
- `.trellis/tasks/archive/2026-11/11-06-debian-mirror-backend-build/check.jsonl`
- `.trellis/tasks/archive/2026-11/11-06-debian-mirror-backend-build/design.md`
- `.trellis/tasks/archive/2026-11/11-06-debian-mirror-backend-build/implement.jsonl`
- `.trellis/tasks/archive/2026-11/11-06-debian-mirror-backend-build/implement.md`
- `.trellis/tasks/archive/2026-11/11-06-debian-mirror-backend-build/prd.md`
- `.trellis/tasks/archive/2026-11/11-06-debian-mirror-backend-build/research/mirror-build-results.md`
- `.trellis/tasks/archive/2026-11/11-06-debian-mirror-backend-build/task.json`

## Explicit exclusions

- `docs/evidence/phase1/doctor.json`: machine-specific environment diagnostic snapshot from the earlier phase; not a CareerSprout runtime/build input or production release dependency.
- `backend/.env`, `frontend/.env.local`, any other `.env*`, private deployment secrets, credentials, and key files: ignored/private; never commit or include in build/archive artifacts.
- Local build outputs, Docker images/archives, caches, dependencies, and runtime data: generated/non-source artifacts; not part of the source commit.

This source inventory remains scoped to the release commit above; the post-deployment report updates `prd.md`, `implement.md`, and `docs/CAREER_SPROUT_DOCKER_DEPLOYMENT.md` are documentation-only and do not change image/config inputs. `docs/evidence/phase1/doctor.json` remains the only explicitly excluded untracked path.
