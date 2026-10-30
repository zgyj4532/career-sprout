# Technical design

## Scope and UX
Extend the current campus Express/MongoDB and React entry, reusing CampusShell and campus design. One class invitation and one informed join confirmation authorize both specified class data and teacher job recommendation/resume generation and export. The teacher selects a job; existing student data is reused for matching and targeted generation, with per-student outcomes and retry instead of extra student-side actions.

## Authorization and class data
A verified, allowlisted teacher owns classes and issues revocable or expiring non-enumerable invitations. Joining records class membership and explicit consent including teacher identity, fields, AI processing, targeted generation and export. Active membership grants those purposes to that teacher. Exit revokes that class-derived access immediately, not independent grants or other active class memberships. Existing grants cannot silently acquire the new purpose. Server-side checks at candidate retrieval, generation and before archive release must account for all valid authorization sources and races. Update the old target approval gate for class-consented flows without granting wider access to legacy grants. No authorization solely based on client role.

Project exact disclosed class fields; do not disclose raw interviews or unrelated personal data. Aggregate active members only, label unknowns and sample sizes. Guidance scoped by class, teacher and student: teachers write, students read and update progress. Students retain their history after exit; teachers lose access. Explain that already downloaded files cannot be recalled.

## Generation, compression and export
Use existing configured model/agent integration with the student's persisted factual source and target job to generate a tailored version, checking grounding and factual fidelity. On actual PDF exceeding 1.5 A4 pages invoke AI to compress, then re-render and re-check; preserve original and expose compressed draft and change review. Enforce bounded attempts, cancellation and explicit per-item errors for model unavailable, factual validation failures and still-too-long results; never truncate, invent or report false success. Automatic teacher generation/export is allowed by explicit class join consent; per-target manual approval is not required for that scope. Existing separately consented grants retain their previous semantics until user explicitly consents to changed purposes. Validate source/job revisions, active consent and time status again before release. Batch manifest reflects per-item results; prevent leaks when permissions change during generation.

## Compatibility and operations
No implied enrollment or retrospective change to existing consents. Reuse renderer and real printed text position checks. Mongo schema/index changes must support existing records and safe rollback without deleting user data. No public deployment until filing is approved.
