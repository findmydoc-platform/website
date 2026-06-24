# About Page Trust Narrative

## Summary

The About page is composed around the trust-system story instead of treating that story as an inserted feature block. The page arc is:

1. why findmydoc exists
2. how the trust system makes comparison context usable
3. who is accountable for the system
4. what remains transparent
5. what visitors can do next

The implementation uses the existing `landingPages.about` CMS fields for hero, why, team, and transparency content. The transparency list stays within the current three-item CMS limit. The closing CTA is code-owned because the current CMS shape has no page-level closing CTA group and the same two destinations are already fixed route actions.
The trust story component is the content and motion anchor. Its story text, labels, animation, particles, and scroll logic stay unchanged; the surrounding page adapts to it.

## Content Audit

| Surface | Classification | Direction |
| --- | --- | --- |
| Hero | Rewrite | Move from a team-page promise to an `About findmydoc` entry point that frames patients, clinics, and responsible profile presentation. |
| Why section | Redesign | Present the three raw signal inputs before the trust story: scattered information, comparison context, and decision boundary. |
| Trust-system story | Keep | Keep component copy, labels, animation, particles, and scroll logic unchanged; only remove explicit outer stage rounding when it is locally set. |
| Team section | Redesign | Present the team as an accountability layer tied to the trust promise rather than as a classic biography block. |
| Transparency section | Redesign | Present the CMS items as explicit trust boundaries after the story, not as a generic split text appendix. |
| Closing CTA | Add | End with two clear next steps: compare clinics or register a clinic. |

## Narrative Contract

- The hero names the page and explains why findmydoc matters without overclaiming medical value.
- The Why section shows the signal inputs before the Trust Story explains the product mechanism.
- The Trust Story owns the exact language around verification, transparency, privacy, and access; surrounding copy must not rewrite or duplicate its story text.
- The Team section makes responsibility visible through concrete role-owned accountability.
- The Transparency section states boundaries: clinic profile responsibility, reviewed evidence signals, direct clinic contact, and separation from medical advice.
- The Closing CTA gives patients and clinics their next route without adding a new claim.

## Responsive Direction

- `320` and `375`: keep a vertical editorial rhythm, no side-by-side dependencies, no horizontal overflow, and stable CTA stacking.
- `640` and `768`: preserve the same content order while allowing portrait/text pairs and CTA groups to widen naturally.
- `1024` and `1280`: use a consistent two-column context rail around the story, with the trust story still reading as the visual peak.
- Short-height mobile states must prove the trust-story handoff, team handoff, transparency section, and closing CTA remain reachable.

## CMS and Implementation Boundaries

- No Payload schema or migration is required for this iteration.
- Baseline seed copy updates the CMS-owned about content for local and seeded environments.
- Live CMS copy still has to be edited in Payload if production content should change outside a seed reset.
- The isolated `AboutTrustSystemStory` copy, labels, animation, particle count, WebGL handoff, and reduced-motion behavior stay out of scope.

## Acceptance Checks

- Storybook asserts section order and the expected signal, trust-story, accountability, transparency, and closing CTA copy.
- Playwright route coverage checks `/about` across `320`, `375`, `640`, `768`, `1024`, `1280`, plus short-height mobile states.
- Route QA checks no horizontal overflow, no hard browser errors, visible trust-story handoff, visible team handoff, and usable final CTA links.
