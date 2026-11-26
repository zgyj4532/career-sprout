# Implementation and verification

1. Capture the original mobile and desktop first folds. Remove mobile shell chrome, add the accessible utility destination, then put the four Profile buttons first. Verify desktop and existing URLs remain unchanged.
2. Split Profile into leaf views with shared draft state and validation focus. Verify import, authorization, cross-view edits and browser history before moving on.
3. Convert Jobs, Resume and Interview independently using the design page map. Exercise list restoration, screenshot and resume deep links, save recovery, and interview recording and confirmation. Preserve existing defaults and permissions.
4. Run focused campus regressions, scoped ESLint and campus build using the pinned WSL runtime. In browser, check 320×568, 390×844 and desktop, including first-fold actions, keyboard focus, enlarged text and safe areas. Check actual iOS Safari and Android Chrome where available; record device gaps separately. Provide a localhost preview, without deployment.
