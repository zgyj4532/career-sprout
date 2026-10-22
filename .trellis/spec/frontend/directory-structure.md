# Directory Structure

## Campus entry

The active local product is `frontend/src/campus/`. `frontend/vite.config.js` chooses `@app-entry` and `@app-styles` at configuration time for `VITE_APP_PROFILE=campus-local`. Keep this boundary: runtime conditional imports still pull the dormant upstream application into the build.

- `CampusApp.jsx`: router and portal/workspace/interview-room shells.
- `pages/*Page.jsx`: route state, server loading, forms and actions. Examples: `ProfilePage.jsx`, `JobsPage.jsx`, `ResumePage.jsx`.
- `components/`: shared visible flows such as `VoiceInput`, `JobSelect`, `RequestError`, and import confirmation.
- `hooks/`: browser resource lifecycles (`useAudioCapture`, `useQuestionSpeech`).
- `api.js`: HTTP, safe errors, download lifecycle and bounded diagnostics.
- `validation.js`: safe field/code projection and Chinese corrections.
- `material.js`, `import/`: domain projections and import/preparation helpers.
- `campus.css`, `base.css`: campus plain CSS; `bits/` and `art/` contain existing decorative components.
- `__tests__/` beside the owning module: Vitest behavior regressions.

## Naming and boundaries

React components use PascalCase `.jsx`; pure helpers use camelCase `.js`. Browser hooks start with `use`. Keep route-specific state in its page; extract a shared component only when the same behavior has multiple consumers. Campus features must not import the dormant full application or require its Tailwind/PWA graph. Existing upstream modules remain available outside the campus profile.
