# Profile sections and one-click import

## Goal
Let students upload once and edit one category at a time without retyping or saving each category separately.

## Scope
- Four addressable views: Personal Profile (basic details, education, availability), Experiences and Ideas, Skills and Other Materials, Import and Authorization. Preserve the existing default and materials links, draft ownership, navigation guard and consent.
- Put a visible import shortcut on the default screen. After parsing, show a short summary of destinations and one primary confirmation. Populate fields via existing confirmed import and refresh all views; expose detailed corrections only when requested or required. Keep original evidence, avoid silent replacement, leave unknowns blank and do not infer proficiency. Import never changes sharing grants.
- No global navigation, resume editor, model, or API redesign. Reuse existing import, versioning, and recovery flow.

## Evidence
`ProfilePage.jsx:138-194` already owns the shared form and refreshes after import. `ImportConfirm.jsx:47-53` already renders recognized education, experiences, skills, materials and issues. `import/confirmCopy.js:15-25` already distinguishes clear and review-required paths.

## Acceptance
- Each view shows only its own content. Back/Forward and direct links work; drafts survive switching and still trigger protection on leave.
- A single confirmation on a clean import places supported content in its destination views with no duplicate manual saves. An ambiguous or conflicting import preserves existing data and offers targeted review or existing safe partial confirmation where supported. Failure/unknown results never appear as saved; recovery remains available.
- Browser checks at 320/390/768/1440 CSS px: no horizontal page scrolling; all view links and primary actions accessible with touch and keyboard.
