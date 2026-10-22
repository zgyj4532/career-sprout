# Bundle evidence and mature references

## Executed baseline
WSL Node24.14.1, installed Vite7.3.5, campus-local,384MiB heap. Programmatic production build with write:false completed9.04s:546 transformed modules; one emitted JS chunk with359 retained modules,625144 bytes,gzip197388; imports=[] and dynamicImports=[]. No product/config edits. baseline.json contains output.

renderedLength attribution is before final minification, not comparable additive final bytes: react-dom561393; motion-dom290093; application248820; react-router227370; @clerk/clerk-react99420; framer-motion89277; @clerk/shared35202. Do not present these as actual downloaded sizes.

CampusApp.jsx:6-16 statically imports all route pages. Slogan.jsx:2-3 statically imports useReducedMotion and BlurText; :26 only renders animation after user click. main.jsx:4 and auth.jsx:2 import Clerk; retain auth semantics rather than treating credentials as a performance switch. Vite config already isolates campus/fullApp at configuration time and disables campus PWA; preserve it.

## Official references
- https://v7.vite.dev/guide/build.html : version-matched Rollup chunk configuration, preloadError and stale deployed assets. Its reload example is not safe to copy automatically into dirty forms; HTML no-cache and retaining hashed old assets matter.
- https://react.dev/reference/react/lazy : module-top-level lazy, Suspense fallback, cached resolved/rejected promises, nearest error boundary. Resetting boundary alone does not retry cached rejected lazy import.
- https://reactrouter.com/start/data/route-object : data-router lazy concept. Current page references v8 APIs, so do not copy new APIs blindly into installed7.18.1; prefer existing React lazy integration to avoid route architecture migration.
- https://reactrouter.com/6.30.6/route/lazy : established data-router-only lazy route matching constraints; descendant Routes under a wildcard are not automatically lazy route objects.
- https://rollupjs.org/configuration-options/#output-manualchunks : explicit dependency grouping is a secondary tool, not proof of lower initial transfer.

## Decision
Keep root router/session/unsaved guard and Home eager; lazy-load non-home route components with page-local pending/error states. Lazy-load BlurText only on interaction and replace eager Motion reduced-motion hook with a small native matchMedia subscription. Keep phrase text visible while animation downloads/fails; preserve toggle and reduced-motion behavior. Do not unmount dirty editors for optional tool splitting.

Manual chunks only if resulting measured shared chunk needs it; no all-node_modules vendor bucket, duplicate React, arbitrary filename splitting, disabled warning or CDN externalization. No provider/auth migration. Exact optimized size is not known until implementation; no promised savings percentage.
