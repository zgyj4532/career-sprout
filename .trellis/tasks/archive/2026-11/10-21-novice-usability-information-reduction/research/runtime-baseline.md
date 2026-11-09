# Runtime baseline — 2026-10-21

## Executed

- Initial health request found no campus API running.
- First supervised launch using `wsl --cd /mnt/e/github/career-sprout` failed with `Wsl/ERROR_PATH_NOT_FOUND`; user notification reported exit127. Did not repeat the same command.
- Environment inspection confirmed Ubuntu-24.04 and default WSL cwd `/mnt/e/github/career-sprout`.
- Changed launch to `wsl.exe --exec node scripts/local/dev-local.mjs`. Existing project Mongo/Redis containers were already running and healthy. Campus API reached health200 and Vite became ready at 127.0.0.1:5173.
- Opened actual homepage in managed Chromium, 1440x1000. Observed CareerSprout title, history/account links, slogan control, example disclosure and four portal links. Initial snapshot was before the progress request completed; it cannot establish the final homepage density.
- Server logs then showed actual GET200 for auth/status, campus/me, resumes and interview/history. No mutation/model request was initiated by this investigation.
- Before page-density capture, supervised service exited1; browser navigation failed with connection refused. Runtime log contains startup only, no child-exit reason. Subsequent WSL process listing contains no owned campus backend/Vite process. Root cause is undetermined; do not attribute it to an application defect or memory exhaustion without evidence.

## Limits

No complete screenshot baseline, desktop/narrow comparison, visual density counts or interactive workflow acceptance was obtained. Source-based findings are labelled separately. No tests/build/lint were run in planning. No successful full-surface verification is claimed. Restore stable local preview before implementation layout acceptance; user scope decisions can still proceed from source and external evidence.

3–5 novice students and physical-mobile acceptance remain BLOCKED_EXTERNAL until new-server filing/deployment allows the acceptance environment. Existing user-confirmed microphone/speaker verification is unchanged.
