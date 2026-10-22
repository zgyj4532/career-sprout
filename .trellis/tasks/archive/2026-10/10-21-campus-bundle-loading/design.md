# Proposed bundle design

## Scope
Change CampusApp route imports and page loading boundary; Slogan/BlurText loading boundary; only necessary shared CSS/test/config updates. No backend or authentication migration. Existing all-route eager graph is baseline; preserve compile-time campus/fullApp separation.

## Route loading
Declare React.lazy components at module top level, including named History exports via explicit default adapters. Home/shell/router/providers stay eager. Place Suspense and error boundary at route content, not outside session/unsaved providers; stable component identity and no arbitrary key-based remounts. Preserve wildcard paths, history detail/session deep links, login/register wildcards and teacher route. Slow loading shows readable status within intact navigation. Existing router blocker runs before leaving dirty forms.

## Failure policy
No unconditional vite:preloadError reload, preventDefault suppression, infinite retries or cache-busting arbitrary URLs. A rejected lazy promise is cached; default recovery offers navigation home and explicit refresh after clearly warning about unsaved work, honoring beforeunload guard. Do not offer a fake retry that merely resets ErrorBoundary. Error state resets on a different route but does not remount current dirty editor on unrelated provider renders. Optional animation failure keeps plain text and functioning toggle, not a whole-app error.

## Interaction animation
Native matchMedia('(prefers-reduced-motion: reduce)') with listener cleanup replaces eager useReducedMotion import in Slogan. Module-top-level lazy BlurText requested only when non-reduced-motion click actually renders animation. Keep current plain phrase as fallback and dimensions stable; preserve current click timing/cancellation/unmount behavior. Initial homepage does not request Motion chunk. No animation prefetch.

## Chunking and metrics
Use Rollup automatic shared extraction first. Measure entry static import closure, each chunk raw/gzip, total emitted bytes and actual cold/warm production browser requests. If a shared chunk exceeds threshold use narrowly justified manualChunks, verify dependency graph/no cycles/order changes. Separate no-Clerk-key local build and configured-key build when available; no real credential/network operation needed to inspect graph, never expose a key. Cannot exclude mandatory auth code merely to meet a number.

## Deployment
Document HTML revalidation, immutable hashed assets and retention across releases; no server deployment in scope. Dynamic JS/CSS uses configured Vite base. Campus has no new service-worker prefetch. Rollback reverts imports/boundaries/config together without data migration.

## Acceptance
All chunks below original500kB threshold; homepage initial static closure smaller than625144 bytes and no unused route/Motion loads. Actual production preview deep links, pending/failure/navigation/blocker, reduced motion and repeated toggles; never claim dev server graph proves production splitting. Authentication capability unchanged. Existing scoped tests/lint and384MiB campus build once after integrated edits, then only changed failures rerun.
