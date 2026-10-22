# Type Safety

## Actual language and validation

The campus frontend is JavaScript/JSX, not TypeScript. There is no campus `tsc` gate. Do not introduce a TypeScript migration or claim type checking ran. Server input validation uses Zod through `backend/src/middleware/validate.js`; client validation is UX, not authorization.

`api.js` owns HTTP response parsing and `CampusApiError`. `campusData(path, options)` unwraps the new campus `{success:true,data}` envelope. Legacy resume responses differ; `resumeRows(payload)` normalizes their list shape. Do not propagate alternative envelope guesses into individual components.

```js
const profile = await campusData('/me')
const records = resumeRows(await campusFetch('/api/resumes'))
```

## Safe projections

`validation.js` accepts only bounded known field/code pairs; it never renders submitted values from validation errors. `CampusApiError` carries safe code/requestId/status. `RequestError` renders human corrections separately from collapsible technical details. Preserve explicit zero, false and null semantics: use nullish coalescing where zero is a real value, and check arrays before iterating external payloads.

Server ownership and publication state cannot be trusted from model/client output. Treat imported files and model output as untrusted data. Never render raw HTML, interpolate arbitrary API errors, or use a cast/default object to hide malformed state. Missing data is not proof of an empty successful result.
