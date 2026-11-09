# Tencent-hosted proxy investigation — 2026-10-26

## Authorized scope
Read-only SSH investigation; no remote config edits, reloads, installations, account changes or deployments.

## Findings
- Requested zgyj_server alias is absent; local SSH config provides zgyjserver, which connected successfully.
- Linux host runs Docker; sudo -n read-only commands work. Public 80/443 belong to teenai-h5-gateway-1 (Nginx), not host Nginx.
- Gateway already serves hzai.tech and www.hzai.tech; / and /redspider-site/ route to existing company site, remaining paths to existing web service. Do not replace these routes.
- Public certificate covers only hzai.tech and www.hzai.tech; expires 2026-12-22. No wildcard/subdomain coverage observed. Private key was not read.
- Credential-free outbound HTTPS probes reached frontend-api.clerk.dev (501 root response; TLS 0.36s) and api.clerk.com/v1/jwks (401 without credentials; TLS 0.45s). This proves reachability at one moment, not authenticated proxy correctness or mainland-user reliability.

## Official contract
https://clerk.com/docs/guides/dashboard/dns-domains/proxy-fapi.md
Clerk documents an advanced reverse-proxy integration, not a Tencent-managed Clerk mirror. Proxy path must share application domain, preserve body/headers and supply server-side Clerk-Secret-Key, correct Clerk-Proxy-Url and trustworthy original-client IP. Development supports proxy without domain proxy_url; production requires setting it after proxy is ready. Browser ClerkProvider needs proxyUrl. Proxy alone does not prove every bot-protection or third-party dependency is covered.

## Proposed scope
- Username/email/password rather than first/last name; requires real Clerk instance registration-policy change, not relabeling fields.
- Complete compatible Chinese localization with campus overrides; hide Google entry in campus UI, avoid disabling unrelated shared-instance consumers without review.
- Same-origin /__clerk proxy via existing official Express support behind Tencent Nginx; secret remains in server-side environment and no caching of session requests. Preserve existing unrelated apps/routes.
- New app hostname recommended rather than taking over existing root. DNS/certificate and application deployment required; current TLS certificate does not cover proposed new hostname.

## User-owned decision
Select the CareerSprout public application hostname. Suggested career.hzai.tech is not yet authorized, DNS-verified or certificate-covered. Current remote authorization remains read-only.
