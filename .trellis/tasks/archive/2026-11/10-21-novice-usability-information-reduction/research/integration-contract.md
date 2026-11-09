# Implementation wire contract — coordinated 2026-10-21

BackendWorkflow supplied this contract while integrating; final verification must exercise actual implementation, not assume the message is proof.

## Discovery

- POST `/api/interview/discovery/start` `{questionCount:4,language:'zh'}`; no uploaded/typed source prerequisite.
- POST `/api/interview/:id/answer` `{questionId,transcript,duration:0}` persists discovery answer without scoring.
- POST `/api/interview/:id/continue` `{}` generates/persists next question; GET `/api/interview/:id` reconciles accepted progress.
- POST `/api/interview/:id/complete` `{}` produces grounded summary/candidates without scores; no answers means no model/fabricated summary; repeated completed request returns existing result.
- GET `/api/interview/:id/profile-confirmation` returns data with status,candidates,expected,frozen,steps. Candidate `{id,kind,value,state?,source:{questionId,excerpt}}`; expected includes collegeStudent nullable boolean and major string.
- POST same path with `{candidates:[{id,value,state?}],expected,resolutions:{major:'replace'|'keep',collegeStudent:'replace'|'keep'}}`. Resolutions only needed for conflicts. Skip means no confirmation POST.
- Model facts require source evidence; user-edited corrections are explicit user input, not falsely claimed model extraction. Confirmed interests/experiences must preserve concurrent additions and prevent duplicate retries.

## Formal scores

New `scoreVersion: available-v1`, `scoring:{basis,dimensions:{relevance,clarity,confidence,expression},overallScore,comparisonKey}`. Dimensions carry `{score:null|number,observed,answered,weight,effectiveWeight,status}`. Legacy score policy retained; discovery excluded. Verify actual count/weight interpretation and all consumers.

## Save-continue

Resume/job creation uses JSON `operationId`, not a header. Recovery GET `/api/resumes/save-operations/:operationId` and `/api/campus/jobs/save-operations/:operationId` returns acknowledged resource in data. Retrying the same operation must not recreate it; saving and navigating remain separate states.

## Ownership

BackendWorkflow owns all backend models/routes; FrontendInterview owns discovery/session/history UI; FrontendPages owns CampusApp, CSS, API helper allowlist, material projections and page integration. Shared edits coordinated directly. No new provider/vendor or credential changes.
