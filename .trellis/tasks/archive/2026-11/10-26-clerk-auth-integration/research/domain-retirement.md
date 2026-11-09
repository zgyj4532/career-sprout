# Domain retirement — executed 2026-10-26

User explicitly approved permanent old-site shutdown and deletion without backup, then approved the final deletion plan and confirmed execution.

## Removed
Seven containers: teenai-h5-gateway-1, teenai-h5-web-1, teenai-h5-api-1, teenai-h5-postgres-1, redspider-20260924-4f378b1-site-1, redspider-20260924-147a675-site-1, redspider-site-site-1.
Database volume teenai-h5_postgres_data and networks teenai-h5_application / teenai-h5_database.
Verified old Compose deployment roots /opt/teenai-h5 and /opt/redspider-web, including their TLS and application secrets/configuration.
Explicitly inventoried redspider-site/gateway and teenai-h5 web/api/gateway image tags and unused postgres:17-alpine image. No global prune used.

## Verification
Remote docker container, volume and image listings are empty. Both old deployment directories absent. Ports 80/443 have no listeners. Local HTTP request with Host hzai.tech fails connection (HTTP 000), establishing old service shutdown. SSH continues working. Ubuntu crontab absent; root crontab showed only Tencent stargate management task, preserved. Docker system service and cloud management services preserved.

## Boundaries
No registrar/DNS changes, Tencent account changes or other-machine changes. No claim of secure physical media erasure or deletion of provider-managed snapshots. No new-site deployment occurred. Desired new URL remains https://crayzamb.cloud/CareerSprout/ and filing is under review; localization, username registration and new-domain proxy implementation remain separate unfinished scope.
