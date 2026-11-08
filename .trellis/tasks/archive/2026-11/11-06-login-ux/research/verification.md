# Login UX verification — 2026-11-07

## Local verification

WSL Ubuntu-24.04, Node24.14.1/npm11.11.0 selected with nvm. Doctor prerequisites passed; real-account acceptance explicitly external.

- Final command: `npm test --prefix frontend -- src/campus/__tests__/auth.test.jsx src/campus/__tests__/CampusApp.test.jsx src/campus/pages/__tests__/RegistrationForm.test.jsx --maxWorkers=1 --no-file-parallelism`: exit0,109 tests passed (55 session/auth,20 router,34 registration).
- Initial run:104 passed,1 failed due ambiguous status selector in incidental wording assertion. Removed wording assertion while retaining behavior checks; review-added pending logout recovery covered. Intermediate107 passed before social-entry cases. Final109 is authoritative.
- Scoped ESLint over changed campus source/tests: exit0,0 errors,3 warnings (CampusApp Icon unused-argument warning and two auth mixed-export refresh warnings). This preceded final two social click-through tests; final tests/build cover those amendments.
- `VITE_APP_PROFILE=campus-local NODE_OPTIONS=--max-old-space-size=384 npm run build --prefix frontend`: exit0,554 modules,14.07s. No SDK major upgrade. Build success is not deployment evidence.

- Final amended RegistrationForm and its34-case test file received a separate ESLint run after final tests/build: exit0, no warnings or errors.
## Actual browser / API smoke

Real local dev runtime with configured Clerk, real backend/Mongo/Redis, no auth bypass substituted. Managed Chromium:

- Anonymous `/` settled at `/login`; explicit `/profile` remained there and showed authenticated-access guidance.
- Registration has one full-name input, email/new-password autocomplete and Chinese password visibility control. Seven-character synthetic password rejected locally with Chinese error; no provider account submission.
- 360/390/768/1440 viewport width probes: no horizontal overflow, exactly one name field. Desktop and390px screenshots inspected. Keyboard Tab from name focused email.
- Teacher link retains `/login?returnTo=/teacher` and explains that it does not grant authority.
- Final third-party registration entry was clicked and reached `/login?returnTo=%2Fteacher`. No OAuth consent was performed.
- `/api/resumes`: anonymous401 and invalid-bearer401.
- Official Chinese locale fixes email format guidance. Vendor prebuilt login still exposes English Show password/Google accessibility fragments and branding; complete Chinese acceptance remains open.
- WSL mounted-drive Vite transform cache retained an earlier module despite reload; restarting the owned runtime served the final social-entry source. Final screenshot includes that entry.
- Local provider telemetry/protect probe requests showed aborted requests; no genuine signup was submitted, so bot/OTP/session success is not inferred.
- Owned browser tabs closed and both owned dev launches stopped with Ctrl-C (supervisor exit2 on stop); user data and database volumes preserved. No personal browser state cleared.

## Review

Four read-only reviewers covered session/routing, locale/simplicity, registration and security. Two distinct bugs fixed: pending-session logout error left retry inert; custom registration removed discoverable Google signup. Security and registration re-review reported no remaining findings. Locale review reported none. Review results were delivered in agent transcripts; no assertion of new production behavior follows from static review.

## Production evidence and unresolved acceptance

Anonymous production browser baseline and public FAPI established partial Chinese UI, separate optional names, current SDK asset5.128.0 and actual password minimum15. Production signup requires email_code; names optional; captcha/legal/MFA/organization selection not currently required.

User authorized actual minimum8. It was NOT applied: no Platform management credential, CLI login or accessible authenticated Dashboard session. Existing Backend API secret cannot modify auth_password. Detailed supported minimal patch and credential investigation: auth-forms-implementation.md. Frontend permits at least8 but provider remains authoritative; production8 acceptance BLOCKED_EXTERNAL.

The reported production post-registration login incident has not been verified with a real session. Local fixes remove identified session/navigation dead ends but do not establish production root cause or resolution. No real OTP, account creation, teacher account, authenticated logout or OAuth consent performed. Historical user confirmation of basic login on10-29 remains valid but is not current production closure.

No commit, push or deployment. Task remains in_progress, not complete/archived; session active-pointer persistence unavailable due absent context identity.

## Follow-up: user changed production password policy

User confirmed Dashboard minimum8 and requested continued testing. Anonymous managed Chromium readback of production public FAPI returned HTTP200: min_length8, compromised-password rejection enabled, breach enforcement at login enabled, show_zxcvbn true, min_zxcvbn_strength2. This supersedes the earlier minimum15 configuration blocker; the user also enabled strength enforcement.

Actual deployed registration UI, without submitting a signup:
- Seven synthetic characters: visible minimum8 rejection.
- Eight weak numeric characters: visible insufficient-strength rejection after validation settled.
- Eight mixed characters: length/strength error disappeared; not a server signup acceptance claim.
- Twelve mixed characters: visible “Your password meets all the necessary requirements.”

No email/account/OTP submitted, no credential persisted; synthetic password field cleared and managed tab closed. Production still displays separate first/last fields and English validation, so local UI changes have not been deployed. Actual eight-character server signup, delivered verification, authenticated access/logout and the original production login incident remain unverified. Policy readback/UI boundaries passed, not full authentication closure.
