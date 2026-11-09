## Correctness verdict: incorrect

**8 open bugs: 0 P0, 0 P1, 8 P2.** No suggestions or nits. Confidence: **0.97**.

Reviewed the files named in both frontend implementation reports, their affected consumers, regression tests, and corresponding current backend contracts. The seven previous plan-review findings and the subsequent preparation-navigation race have been addressed in the inspected source; they are **not** repeated below.

**Report persistence limitation:** I could not create `.trellis/tasks/10-21-novice-usability-information-reduction/research/review-frontend-correctness.md`: this reviewer’s controlling instructions prohibit file edits, and no write/edit tool is available. The complete report follows for Main to persist.

### 1. [P2] Reconcile profile writes before retrying stale comparison tokens

**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Patch anchor:** `frontend/src/campus/pages/ProfilePage.jsx:47-58`

**Reproducer:** Load a profile, edit both biography and growth material, and save. Let the first `/api/user-profiles/me` PUT commit, but lose its response. Restore connectivity and click save again. The page retains the old `profile.updatedAt`, so the second PUT receives `PROFILE_CONFLICT` and the growth-material write is never reached. The analogous failure occurs when `/api/campus/me` commits but its response is lost: subsequent attempts reuse the obsolete student timestamp. A real concurrent student update creates the same persistent partial-save loop.

**Evidence and impact:** `writeProfileFields` compares the supplied timestamp and advances it on success (`backend/src/campus/profileWrite.js:4-13`). The page updates either token only after receiving its successful response and performs no reconciliation in its catch. It also reports growth material as definitely unsaved after an ambiguous second-write outcome. Once loaded, the error component offers no refresh/reconciliation action (`ProfilePage.jsx:61`); the available reload action explicitly discards local edits. Recovery therefore requires abandoning or manually copying the remaining edits instead of the advertised retry.

**Required correction:** Preserve local edits while reading canonical outcomes and refreshing comparison baselines. Distinguish confirmed failure from unknown completion, and retry only unfinished work.

### 2. [P2] Preserve explicit unknown attendance on subsequent profile saves

**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Patch anchor:** `frontend/src/campus/pages/ProfilePage.jsx:47`

**Reproducer:** Start with `studyStage: '大三'`. Select “未知或暂不回答” for university attendance and save successfully. Reload, edit only the biography, and save again.

**Evidence and impact:** The first save sends `collegeStudent: null`; the backend acknowledges it with `collegeStudentKnown: false` (`backend/src/routes/userProfile.js:71`). On the next save, the frontend omits `collegeStudent` because `collegeStudentKnown` is false, but still sends the unchanged nonempty `studyStage`. The backend’s fallback at `userProfile.js:72-74` then restores `collegeStudent: true` and marks it known. An unrelated edit silently reverses the user’s explicit unknown response.

**Required correction:** Preserve null attendance explicitly across ordinary saves, or track actual attendance/stage edits so an unchanged stage cannot reassert an intentionally cleared fact.

### 3. [P2] Keep acknowledged material saves separate from refresh failures

**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Patch anchor:** `frontend/src/campus/pages/ResumePage.jsx:107-115`  
**Also affected:** `frontend/src/campus/pages/JobsPage.jsx:83-94`

**Reproducer:** Click the non-navigation “保存简历” action. Lose the write response, allow operation recovery to return the acknowledged resource, then fail the following resume-list GET. For jobs, use “保存岗位”, recover the write successfully, and fail the following gap GET.

**Evidence and impact:** `saveMaterialOperation` sets `operation.unknown = true` on response loss but never clears it when recovery succeeds (`frontend/src/campus/saveOperation.js:15-32`). Both pages clear their retained operation after acknowledgement, then perform refresh requests inside the same save try block. A refresh failure reaches the save catch and restores `saveUnknown` from that stale true flag, despite the acknowledged resource already being installed. The page locks the editor and displays “保存结果未知”, but the original recovery operation has already been discarded. Clicking its recovery button allocates another update rather than checking the acknowledged operation; resume updates advance `revision` even when body contents are unchanged (`backend/…

**Required correction:** Clear uncertainty upon acknowledgement and isolate post-save refresh failures from persistence outcome handling. A refresh failure must not recreate an unknown-save state or lose the original operation identity.

### 4. [P2] Honor successful discovery-confirmation acknowledgements

**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Patch anchor:** `frontend/src/campus/components/DiscoveryReport.jsx:42-47`

**Reproducer:** Save discovery profile candidates. Allow the POST to return success with `data.status: 'completed'`, then fail the immediately following confirmation GET.

**Evidence and impact:** The backend returns the canonical confirmation view from `confirmDiscovery` (`backend/src/campus/discoveryConfirmation.js:152`). The frontend discards that POST response and unconditionally calls `load(true)`. If the GET fails, `load` sets `unknown: true`, retaining the old unconfirmed record (`DiscoveryReport.jsx:24-32`). The UI thus says the save outcome is uncertain and locks the candidate editor even though completion—including any `cachePending` status—was acknowledged.

**Required correction:** Apply the POST’s acknowledged confirmation view immediately. A later read failure may warn about refresh failure but must not downgrade completed persistence to unknown.

### 5. [P2] Apply the media admission guard to transcription retries

**Severity:** bug · **Status:** open · **Confidence:** 0.97  
**Patch anchor:** `frontend/src/campus/components/VoiceInput.jsx:18-19`  
**Related changed lines:** `VoiceInput.jsx:28-32,48`

**Reproducer:** Record an answer and let transcription fail, leaving the “重试” control visible. Type an answer and click save. While the answer request is pending, click the transcription retry. Let transcription finish before the answer’s canonical acknowledgement.

**Evidence and impact:** The parent disables `VoiceInput` while saving, but `RequestError` renders an unrestricted retry button, and `transcribe` does not check `disabled`. The retry can therefore start during answer persistence or question playback. Under the new automatic insertion contract, its result appends to the sole answer editor. The pending answer submission already captured the earlier text, and `canonical()` then clears the whole editor when that question’s answer is acknowledged (`frontend/src/campus/pages/InterviewSessionPage.jsx:43-47`). The newly appended transcript is neither submitted nor retained.

**Required correction:** Gate every transcription entry point, including retries, on the parent’s admission state. Preserve capture retry availability once that state permits it.

### 6. [P2] Partition adaptive progress by compatible scoring scope

**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Patch anchor:** `frontend/src/pages/InterviewPrep.jsx:1006-1010`

**Reproducer:** Retain existing legacy `interviewProgress` in local storage, then complete an `available-v1` interview. Alternatively, complete two new interviews with different modes or available-dimension bases.

**Evidence and impact:** The new canonical score is still passed to the unchanged `updateDifficulty(score, progressData)`. That consumer adds every result to one `totalScore`, divides by one completion count, and shares promotion/demotion streaks (`frontend/src/utils/interviewDifficulty.js:17-60`). The resulting mixed average is displayed as “Average Score” (`InterviewPrep.jsx:2027-2033`). Unlike History and Analytics, this remaining aggregate never receives a version/mode/basis key. New scores are consequently averaged directly with legacy or incompatible scores, contrary to the approved scoring contract.

**Required correction:** Keep adaptive aggregates and streaks in compatible scoring groups, preserving legacy progress without merging it into the new scope.

### 7. [P2] Retain unscored formal sessions in analytics

**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Patch anchor:** `frontend/src/pages/Analytics.jsx:74-79`

**Reproducer:** Return one completed formal `available-v1` session with all dimensions unavailable and `scoring.overallScore: null`, as permitted by the new backend contract. Open Analytics.

**Evidence and impact:** `comparisonKey` returns null whenever there is no overall score (`frontend/src/utils/interviewScores.js:7-10`). Analytics removes null keys and then filters its entire session collection by the selected comparison group. With only unscored sessions, that collection becomes empty: the page shows zero sessions and “No interview history available yet” (`Analytics.jsx:335-336`). With mixed records, unscored sessions disappear from the recent-session list. Excluding a record from numerical comparisons should not erase a real completed formal session.

**Required correction:** Separate the complete formal-session collection from the comparable scored subset. Show unscored sessions with unavailable metrics while excluding them from numerical averages and trends.

### 8. [P2] Migrate per-answer cards to the nullable score contract

**Severity:** bug · **Status:** open · **Confidence:** 0.99  
**Patch-introduced producer anchor:** `backend/src/models/Interview.model.js:12-15`  
**Frontend consumers:** `frontend/src/pages/InterviewPrep.jsx:2435-2436`, `frontend/src/pages/InterviewReplay.jsx:306`  
**Defective dispatch/rendering:** `frontend/src/components/interview/QuestionAnalysisCard.jsx:8-9,38-45,57-67`

**Reproducer:** Complete or replay a new formal interview whose answer has `relevance: 90`, `clarity: null`, and `confidence: null`. Inspect the per-answer card. Repeat with all three values null.

**Evidence and impact:** The patched producer deliberately preserves missing scores as null (`backend/src/services/interviewScoring.js:6-17`). Both reviewed legacy pages still forward those answers unchanged into `QuestionAnalysisCard`. That consumer converts each missing dimension to zero and averages all three, showing **30%** for the first example and **0% / “Needs Work”** for the second. Although the top-level report now honors canonical nullable scoring, its detailed answers still penalize unobserved dimensions. This is a missing consumer migration for the newly introduced contract, not a claim that the old zero-filling expression itself was newly written.

**Required correction:** Update the shared per-answer consumer to distinguish unavailable dimensions from genuine zero and avoid manufacturing a total or negative assessment from missing observations.

## Residual evidence limits

- **No tests, builds, lint, formatters, runtime sessions, browser actions, or source edits were performed.** Reproducers above are source-derived, not executed results.
- Backend integration changed during review; affected contracts were reread from current files. Findings do not rely on unfinished backend placeholders.
- Current code includes the prior fixes for recent-resume ordering, consumed preparation parameters, discovery length limits, experience representation, router Back/Forward protection, flattened feedback disclosure, visible score coverage, and late autosave navigation.
- The normal interview answer/completion recovery paths, capture cancellation generation checks, server-frozen discovery candidates, completed-target skipping, and frozen material-save intent were traced. No additional evidence-backed defect is asserted in those paths.
- Parent verification should add the exact adverse interleavings above; existing tests mostly cover successful reconciliation or first failures, not these subsequent failures and cross-consumer cases.
- Device microphone behavior, real-provider quality, 390px keyboard/focus behavior, and novice acceptance remain outside this static review.

[Some lines truncated to 768 chars. Use agent://FrontendCorrectness:raw:39-39 to read line 39 whole]