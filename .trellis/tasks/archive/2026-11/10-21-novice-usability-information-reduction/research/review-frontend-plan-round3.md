**Follow-up autosave race: fixed in static review.**

Evidence in `frontend/src/campus/pages/InterviewPage.jsx:113-127`:
- Success/error callbacks require the originating effect to remain current, the preparation owner to remain active, and the route key to match.
- Cleanup invalidates callbacks on unmount or superseding preparation changes.
- The guard executes **before** `consumeSelections()`, preventing late completion from invoking the stale navigation setter.

The added deferred-save regressions in `frontend/src/campus/pages/__tests__/InterviewPage.test.jsx:103-141` cover:
1. Navigating away before save resolution.
2. Replacing the selected resume with newer text-only preparation before resolution.

**Final review status:** all seven original findings and the follow-up navigation-race finding are fixed by source inspection. No additional actionable defect found in this correction.

**Overall correctness: correct for the reviewed fixes. Confidence: 0.97.** This is not an acceptance-test PASS: no checks or browser actions were run. Parent-owned integrated tests and actual browser proof remain outstanding.