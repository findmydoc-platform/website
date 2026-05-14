# Mockup Prompting

Use this reference before generating findmydoc design-planning mockups with `$imagegen`.

## Imagegen Mode

Use the built-in `$imagegen` path by default. Do not use the imagegen CLI fallback unless the user explicitly asks for CLI/API/model control or the imagegen skill requires confirmation for a special case.

Project-bound mockups must be copied into the scenario folder as `mobile.png`, `tablet.png`, and `desktop.png`.

## Logo Reference

If a mockup shows the findmydoc logo or wordmark, always use the repository's real dark logo as an input reference:

- Imagegen reference asset: `public/fmd-logo-1-dark.png`
- Implementation source asset: `public/fmd-logo-1-dark.svg`
- Existing implementation component: `src/components/molecules/Logo/Logo.tsx`

Before calling `$imagegen`, inspect `public/fmd-logo-1-dark.png` with the image viewer and label it as the brand logo reference. In the image prompt, explicitly state that the visible logo must match the referenced dark findmydoc wordmark and must not be redrawn from memory.

Do not place a fake or approximate findmydoc wordmark in mockups. If imagegen cannot render the wordmark accurately, either omit the visible logo from the mockup or describe in the README that the implemented UI must use the real `Logo` component and `public/fmd-logo-1-dark.svg`.

## Shared Prompt Shape

Use the `ui-mockup` use case and include:

```text
Use case: ui-mockup
Asset type: findmydoc design planning mockup for <mobile|tablet|desktop>
Primary request: <scenario goal>
Reference context: <current route/component/screenshot facts>
Brand logo reference: use public/fmd-logo-1-dark.png if the logo is visible
Audience: patient comparing or evaluating clinics
Style/medium: polished healthcare web UI mockup, calm, trustworthy, transparent
Composition/framing: <viewport-specific layout>
Color palette: consistent with existing findmydoc site; restrained medical trust palette; no decorative blobs
Text: short exact UI labels only; README remains source of truth for exact copy
Constraints: show all relevant functions for this form factor; every visible UI element must be documented later in the Visible UI Contract
Avoid: decorative gimmicks, unsupported trust badges, fake metrics, fake or approximate findmydoc logo, unreadable dense text, marketing hero composition, stock-like imagery
```

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
- verify any visible findmydoc logo against `public/fmd-logo-1-dark.png`
- reject unsupported badges, claims, ratings, or metrics
- reject fake, misspelled, or approximate findmydoc wordmarks
- reject UI text that implies hidden functionality not in scope
- reject unreadable mobile text, cramped touch targets, or incoherent hierarchy
- ensure the image can be described completely in the README contract
