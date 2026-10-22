# Mature patterns and limits — 2026-10-21

Sources below were read directly during planning. They inform design, not a claim of measured usability or security certification.

| Source | Observed guidance | Application | Constraint |
| --- | --- | --- | --- |
| [GOV.UK Details](https://design-system.service.gov.uk/components/details/) | Reveal information needed by only some users; never hide what most users need. | Optional examples, original source text and technical diagnostics may disclose on demand. | Save destination, review issues and recovery remain visible. |
| [GOV.UK Accordion](https://design-system.service.gov.uk/components/accordion/) | Simplify content first; accordions can be missed; avoid nested disclosure and splitting a question series into accordions. | Delete repeated explanation and duplicate summaries before adding containers. | Do not fold all profile fields into an accordion and call that novice-friendly. |
| [GOV.UK Check answers](https://design-system.service.gov.uk/patterns/check-answers/) | One confirmation for small/medium transactions; relevant sections only; explicit submit action; changing a field returns directly to review with other values retained. | Keep import result summary, editable details and explicit destination/save. | Confirmation is not persistence; corrections must not replay all steps or discard other inputs. |
| [GOV.UK Complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/) | Task lists are for long, multi-session transactions; simplify the transaction first. | Homepage should not make optional profile/jobs/resume steps look mandatory. | Existing resume holders may proceed directly to interview. Avoid duplicate five-step path plus four large portals plus next-action card. |
| [Europass CV](https://europass.europa.eu/en/create-europass-cv) | Reuse a profile to create multiple CVs by selecting relevant information. | Reuse existing education/experience instead of asking for it repeatedly; distinguish profile from specific resume. | This is official product documentation, not inspection of its private backend. Do not import Europass publication defaults or force complete profiles before practice. |
| [WCAG 2.2 redundant entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html) | Previously entered data in the same process should be auto-populated or selectable, except essential/security/invalid-data cases. | Preserve interview preparation across screenshot detours and make existing material selectable. | The criterion does not itself require cross-session storage and explicitly excludes differently supplied document uploads. Account-scoped storage/privacy still applies. |
| [WCAG 2.2 focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | Sticky content must not fully obscure focused controls; scroll padding/reflow may help. | Verify bottom navigation + save bar + keyboard focus at narrow widths. | Desktop emulation is not physical-mobile acceptance; filing/deployment blocker remains. |

## Proposed design direction, not implementation approval

Keep the existing CareerSprout identity and readable font sizes. Reduce simultaneous decisions rather than compressing text. One dominant task action per current state; secondary functions remain discoverable with descriptive labels. Preserve keyboard labels, focus visibility, reduced motion and explicit private/public scope.

## Safety review criteria

- UI hiding is not authorization. Existing ownership, teacher grants and backend checks remain authoritative.
- A collapsed component must not unmount active recording, pending ASR review, dirty editors or frozen import recovery state.
- Adoption, saving, sharing approval and export remain distinct transitions.
- Avoid introducing a tour, global state library, new UI dependency or onboarding service merely to reduce information density.
- Unknown scores require provenance/contract review; visual simplification cannot safely turn historical zero into missing or recalculate history silently.
