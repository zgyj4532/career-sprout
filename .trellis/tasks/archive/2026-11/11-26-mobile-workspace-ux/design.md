# Mobile workspace design

## Researched references

- [Apple HIG: Tab bars](https://developer.apple.com/design/human-interface-guidelines/components/navigation-and-search/tab-bars) — keep the four primary destinations labelled and stable; subsection screens belong below these destinations, not in additional bottom tabs.
- [Material 3: Navigation bar](https://m3.material.io/components/navigation-bar/guidelines) — bottom navigation for top-level peer destinations on small screens; move secondary utilities out of the primary bar.
- [GOV.UK: Question pages](https://design-system.service.gov.uk/patterns/question-pages/) · [live example](https://design-system.service.gov.uk/patterns/question-pages/default/) — one decision per screen, explicit back and continue, restore prior input. Use this for short editing screens, not a compulsory wizard through optional profile sections.
- [GitHub Mobile documentation](https://docs.github.com/en/get-started/using-github/github-mobile#adding-switching-or-signing-out-of-accounts) — account management sits under a profile destination. Borrow placement, not the long-press gesture: use a visible text link.

These are public documentation and examples, not device-tested competitor sessions.

## Shell and page map

Use the current mobile shell breakpoint. Remove the persistent mobile workspace brand/status header; expose Home, History and Account in a compact utility page reached via a visible ‘工作台菜单’ link in the personal profile, and retain existing contextual history links. Show local-development identity in the utility page. Leave desktop shell, authentication, home and focused-session exit behavior intact.

- Profile root: existing 2×2 section buttons first; no visible title, subtitle or illustration, with accessible name and focus retained. Each category shows short destination rows. Personal: basics, education, availability. Experiences: list → single record. Skills: tags, self-assessment, other materials. Import and Authorization: import/recover, class assistance, sharing. Leaf pages show a compact back affordance and short title, not the four buttons again.
- Jobs: list → details or edit; manual entry and screenshot import remain explicit. Requirements and gap review open from job details instead of extending the form. Restore list pagination and position.
- Resume: editor, import and versions remain distinct. Move optional materials/JD and AI review to focused subviews, while keeping save/export accessible without hunting for a footer. Keep recorded content and existing import links intact.
- Interview: short preparation screens for direction, materials and settings, with a direct start path using current defaults. Keep one question per session view and existing recording, confirmation and exit controls; feedback is separate from answering.

## State and sizing

Use addressable subviews with Back/Forward; retain existing links, params and one draft owner per workflow. Do not add broad guard exemptions: only switches that retain the exact work are in-place. Save and validation keep a path back to the destination field; no hidden invalid controls or unexpected autosave. Keep touch targets at least 44 CSS px, compensate safe areas and avoid stacked fixed bars. With keyboard or enlarged text allow natural scrolling; never clip content merely to fit one screen. Preserve consent and recording visibility and do not remount ongoing operations on view changes.

## Visual polish and interface copy

Keep the workspace feeling like a student's notebook, not a marketing page. Use the existing green `#0f6e56` for selection and primary actions, paper `#f4efe6`, warm surface `#fffaf3`, ink `#1c1915`, muted ink `#5f584e`, and divider `#d9d0c3`. On phones, use flat paper without the background pattern. Keep the four illustrated category buttons, then group destination rows on one quiet surface separated by rules; make the workspace menu visibly secondary. Desktop illustrations and workspace structure stay intact.

Mobile typography: existing CJK sans stack, 24px title, 18px section, 16px task/field text, 14px supporting copy, 12px labelled bottom navigation. Use rem values and 1.5 body line-height. Use a 4px spacing unit: 8px for paired controls, 12px for row inset, 16px page gutter, 24px between unrelated groups. Keep minimum 44px hit areas and retain labelled arrows/selected states and focus rings. Avoid adding gradients, shadows or movement for decoration.

Apply [ui-design](https://skills.sh/cniska/agent-skills/ui-design) to hierarchy and shared tokens. For Chinese copy, adapt the [Cola Skill humanizer](https://colaskill.com/zh/ste80-humanizer/) method: remove filler, then state the action or next step in plain words. Review user-facing headings, hints, empty states and button-adjacent text in the four workspaces. Preserve the meaning of saved/unsaved, authorization, failure, AI review and recording states; do not rewrite model output or change business behavior.
