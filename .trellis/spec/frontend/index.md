# Frontend Development Guidelines

> Best practices for frontend development in this project.

---

## Overview

Campus conventions below are grounded in the current React/Vite implementation. Read the relevant files before editing; the upstream full application has separate dormant modules.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Directory Structure](./directory-structure.md) | Entry boundary and campus module layout | Populated |
| [Component Guidelines](./component-guidelines.md) | Forms, AI adoption, null and accessibility boundaries | Populated |
| [Hook Guidelines](./hook-guidelines.md) | Media ownership and stale-response protection | Populated |
| [State Management](./state-management.md) | Server records versus unsaved inputs | Populated |
| [Quality Guidelines](./quality-guidelines.md) | Actual commands and behavior/surface proof | Populated |
| [Type Safety](./type-safety.md) | JavaScript runtime validation and HTTP envelopes | Populated |

---

## Pre-Development Checklist

- Read directory structure and the guide covering the changed behavior.
- For API changes, read type safety and `.trellis/spec/project/campus-phase1/verification.md`.
- For async forms/media, read state management and hook guidelines.
- Read quality guidelines before choosing verification commands.
- Preserve the campus configuration-time entry boundary; do not load the dormant full app.

## Quality Check

Run relevant behavior regressions and actual browser smoke. Report executed commands and external limits separately; a documented command is not a passing result.

---

**Language**: All documentation should be written in **English**.
