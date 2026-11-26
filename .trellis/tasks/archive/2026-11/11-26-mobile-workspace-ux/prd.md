# Mobile workspace UX

## Goal
Make common actions discoverable without vertical scrolling through unrelated content, while allowing long content to scroll naturally.

## Requirements
- At the existing mobile breakpoint, remove the workspace brand/status bar and Profile's visible hero. Put the four existing Profile buttons first. Preserve accessible names, desktop visuals, and reachable Home, History, and Account links via a compact workspace menu.
- Split long workflows into focused, addressable views following the [page map and researched URLs](design.md). Keep drafts, active requests, pending recovery, consent and existing links intact. No backend or desktop redesign.

## Acceptance
- At 320×568 and 390×844 CSS px (portrait, keyboard closed, default text size), all four Profile buttons and the selected category's task links are available without scrolling. Common task entry and primary actions do not require scrolling past unrelated sections. Long documents and enlarged text are not clipped.
- Deep links, in-app back and browser Back/Forward preserve navigation context and draft protection. Mobile targets are at least 44 CSS px and the keyboard, bottom bar and safe areas do not obstruct inputs, save or recording controls.
- Desktop keeps current headers, SVGs and navigation; History and Account remain available on phones. Verify responsive browser behavior and report actual mobile-device checks separately.
