# Mockup Prompting

Use this reference before generating findmydoc design-planning mockups with `$imagegen`.

## Imagegen Mode

Use the built-in `$imagegen` path by default. Do not use the imagegen CLI fallback unless the user explicitly asks for CLI/API/model control or the imagegen skill requires confirmation for a special case.

Project-bound mockups must be copied into the scenario folder as `mobile.png`, `tablet.png`, and `desktop.png`.

## Product Branding Grounding

Before prompting imagegen, capture current product screenshots with Playwright or Storybook and save them under `output/playwright/<topic-or-scenario>/`.

Use those screenshots to ground:

- typography scale and font weight
- button shape, color, hover/focus treatment, and icon treatment
- card radius, border weight, shadow strength, and spacing rhythm
- page background, container width, header/footer treatment, and content density
- existing route hierarchy and mobile stacking patterns
- visible authentication state, account trigger state, and global chrome behavior

Mockup prompts must reference the screenshot paths and explicitly say to preserve the current findmydoc visual language. Do not accept output that looks like a generic medical SaaS dashboard when the current screenshots show a different product style.

If a route cannot be captured because of auth, data, or local runtime blockers, capture the nearest available Storybook state or adjacent public route and document the blocker in the README.

## Logo Reference

If a mockup shows the findmydoc logo or wordmark, always use the repository's real dark logo as an input reference:

- Imagegen reference asset: `public/fmd-logo-1-dark.png`
- Implementation source asset: `public/fmd-logo-1-dark.svg`
- Existing implementation component: `src/components/molecules/Logo/Logo.tsx`

Before calling `$imagegen`, inspect `public/fmd-logo-1-dark.png` with the image viewer and label it as the brand logo reference. In the image prompt, explicitly state that the visible logo must match the referenced dark findmydoc wordmark and must not be redrawn from memory.

Do not place a fake or approximate findmydoc wordmark in mockups. If imagegen cannot render the wordmark accurately, either omit the visible logo from the mockup or describe in the README that the implemented UI must use the real `Logo` component and `public/fmd-logo-1-dark.svg`.

## Route State And Chrome

Mockups must match the route state they are planning:

- private authenticated patient routes show authenticated account chrome, not guest `Sign in`
- unauthenticated redirect/login states are separate scenarios or separate state mockups
- CMS-managed header navigation and mobile menu triggers are global chrome, not issue-owned page features
- copy and controls must not import out-of-scope feature framing such as comparison, contact, dashboard, recommendation, or appointment workflows

When global chrome appears, restate in the README which visible items are reused existing chrome and which page elements are new or changed.

## Shared Prompt Shape

Use the `ui-mockup` use case and include:

```text
Use case: ui-mockup
Asset type: findmydoc design planning mockup for <mobile|tablet|desktop>
Primary request: <scenario goal>
Reference context: <current route/component/screenshot facts>
Product branding reference: <Playwright or Storybook screenshot paths captured before imagegen>
Route state: <authenticated patient|guest public|unauthenticated redirect|staff admin>; describe visible account/header chrome
Brand logo reference: use public/fmd-logo-1-dark.png if the logo is visible
Audience: patient comparing or evaluating clinics
Style/medium: polished healthcare web UI mockup, calm, trustworthy, transparent
Composition/framing: <viewport-specific layout>
Color palette: match current findmydoc screenshots and tokens; restrained medical trust palette; no decorative blobs
Text: short exact UI labels only; README remains source of truth for exact copy
Constraints: preserve current findmydoc typography, spacing, border radius, button treatment, and card density from the branding screenshots; match the route's auth/account chrome state; show all relevant functions for this form factor; every visible UI element must be documented later in the Visible UI Contract
Avoid: decorative gimmicks, unsupported trust badges, fake metrics, fake or approximate findmydoc logo, unreadable dense text, marketing hero composition, stock-like imagery, guest sign-in chrome on authenticated private routes, out-of-scope feature copy
```

## State Coherence

Each generated mockup must represent one coherent runtime state. Do not show populated results and empty states in the same page state, and do not mix mutually exclusive statuses such as active contact and missing contact source.

When alternate states matter:

- use the primary runtime state for `mobile.png`, `tablet.png`, and `desktop.png`
- document alternate states in the README Visible UI Contract and Acceptance Criteria
- optionally create additional files such as `mobile-empty.png` or `desktop-error.png` when visual state proof is needed

For data-driven pages where both populated and empty states are real user paths, create empty-state mockups for every primary form factor:

- `mobile-empty.png`
- `tablet-empty.png`
- `desktop-empty.png`

For mutating controls, add pending or error mockups only when the state changes layout, action availability, live-region behavior, trust messaging, or touch target placement.

## Mobile Prompt Requirements

Mobile mockups must show:

- the primary patient path without hidden required controls
- readable stacked hierarchy
- touch-sized actions
- clear trust/source cues near decision-critical information
- comparison constraints if comparison is part of the flow
- empty, loading, disabled, or limit state only when required by the scenario

## Tablet Prompt Requirements

Tablet mockups must show:

- how the mobile hierarchy adapts without losing core functions
- one additional density or comparison affordance when useful
- touch-safe controls
- no hover-only behavior

## Desktop Prompt Requirements

Desktop mockups must show:

- richer scanning or comparison density
- all patient-critical trust and transparency cues
- clear primary and secondary actions
- no extra functions that are absent from the plan

## Form Factor Defaults

Use these dimensions unless the user or context requires another size:

- mobile: portrait smartphone mockup, approximately `390x844`
- tablet: portrait or landscape tablet mockup, approximately `834x1112` or `1024x768`
- desktop: browser viewport mockup, approximately `1440x1000`

## Prompt Quality Checks

Before accepting a generated image:

- verify that it resembles a real findmydoc UI plan, not an advertisement
- verify that it matches the current product screenshots for typography, spacing, colors, card styling, and button treatment
- verify that route chrome and account state match the planned runtime state
- verify any visible findmydoc logo against `public/fmd-logo-1-dark.png`
- reject unsupported badges, claims, ratings, or metrics
- reject fake, misspelled, or approximate findmydoc wordmarks
- reject out-of-scope copy or controls from adjacent features
- reject UI text that implies hidden functionality not in scope
- reject unreadable mobile text, cramped touch targets, or incoherent hierarchy
- ensure the image can be described completely in the README contract
