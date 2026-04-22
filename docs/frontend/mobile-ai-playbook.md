# Mobile-First AI Playbook

This document is the canonical mobile-first reference for Codex tasks that touch frontend UI in this repository. Keep hard rules in the relevant `AGENTS.md` files and use this playbook for the working heuristics, viewport matrix, prompt scaffolding, and review checklist.
Path-local `AGENTS.md` files should reference this playbook instead of restating the full matrix or `Confirmed` versus `Likely` thresholds unless they need a narrower local exception.

## Mobile-First Default

- Design and verify the narrow viewport first.
- Expand to tablet and desktop only after the mobile hierarchy and interaction model are coherent.
- Prioritize content order, CTA clarity, text wrapping, and touch reachability before decorative density.
- Prefer vertical flow before introducing multi-column layouts.
- Prefer touch-first interactions before hover enhancements.

## Standard Viewport Matrix

Use this matrix unless the task explicitly defines a different one:

- `320px`: smallest hard constraint
- `375px`: default smartphone width
- `640px`: repository `sm`
- `768px`: repository `md`
- `>=1024px`: desktop verification width

If a task affects image behavior, dense dashboards, or wide comparison layouts, include one additional large-screen check at `1280px`.

This same matrix applies to route, component, story, and review work. Do not collapse it to `320px` plus one generic mobile state and one desktop state.

## Short-Height Mobile Checks

Width checks are not enough for sticky and full-height UI. When relevant, also verify:

- browser-chrome or address-bar resize on mobile browsers
- safe-area inset collisions near the top or bottom edge
- dynamic viewport height behavior for full-height panels
- virtual-keyboard overlap for forms, drawers, and bottom sheets
- landscape or other reduced-height mobile states

These short-height checks apply to route, component, story, and review work for drawers, sheets, sticky bars, dialogs, fixed navigation, and full-height panels.

## Mobile Failure Modes

Review these before and after editing:

- horizontal overflow or clipped containers
- text overflow in buttons, pills, cards, tables, and badges
- CTA groups that wrap into ambiguous order or overlap key content
- sticky headers, jump bars, or drawers that hide content or trap scrolling
- dialogs and sheets that exceed the viewport without internal scroll containment
- bottom sheets, sticky CTAs, or full-height panels that break under short-height mobile states
- carousels, tab bars, comparison views, and filters that are hard to use on touch
- hover-only or pointer-precision interactions for essential actions
- image `sizes` hints that do not match the real mobile layout
- mobile layouts that bury the primary action below decorative content
- long labels, validation errors, empty states, loading states, and CMS-realistic content that reorder or clip mobile UI

## Task Output Contract

For frontend UI tasks, the final handoff should include a short mobile QA note with:

- checked viewports
- checked interaction paths or UI states
- checked short-height mobile states when relevant
- confirmed findings or verified states
- remaining mobile risks or follow-up checks
- evidence used: Storybook stories, Playwright evidence, or code-based inference for static layout checks or likely risks

For review tasks, include evidence per finding, not just once for the whole review.

For runtime-sensitive route risks, confirm on the composed route with Playwright or equivalent runtime evidence instead of code inference alone.
For shared mobile UI such as header, navigation, drawers, or sticky bars, sample at least two representative routes or content densities when the same UI spans multiple route types.
For browser-engine-sensitive risks such as safe-area, browser-chrome resize, dynamic viewport height, or virtual-keyboard behavior, treat single-engine runtime evidence as partial unless the engine limitation is stated explicitly.

### Severity Scale

Use the repository's absolute `1-10` severity scale for review findings:

- `9-10`: production-critical or trust-critical issue
- `7-8`: important issue with clear user-flow, business, or reliability impact
- `5-6`: meaningful issue worth fixing soon
- `3-4`: quality or consistency gap with limited standalone impact
- `1-2`: minor polish issue

Do not use relative `high`, `medium`, or `low` labels unless the user explicitly asks for them.

### Confirmed vs. Likely

Use this threshold consistently:

- `Confirmed`: reproducible in Playwright, reproducible in Storybook with the relevant state, or directly provable from code without runtime ambiguity
- `Likely`: plausible from code or layout structure but still dependent on runtime behavior, browser chrome, content volume, or touch interaction to verify

For sticky overlap, scroll traps, touch reachability, safe-area issues, virtual-keyboard overlap, and similar runtime-sensitive behavior, default to `Likely` unless a runtime or story reproduction exists.
For browser-engine-sensitive risks such as safe-area, browser-chrome resize, dynamic viewport height, or virtual-keyboard behavior, treat single-engine runtime evidence as partial unless the engine limitation is stated explicitly.

## Prompt Scaffolding

Use these ingredients when prompting Codex for mobile UI work:

### Build Prompt Shape

Include:

- the exact route, block, or component in scope
- the primary mobile user goal
- the viewport matrix to verify
- the exact mobile interaction cycles or failure states to verify
- the short-height mobile states to verify when the UI uses drawers, sheets, sticky bars, fixed navigation, dialogs, or full-height panels
- the worst-case content states to verify when the layout depends on content shape
- any relevant repo-specific hotspots from the list below
- any fixed constraints, such as keeping Payload boundaries or preserving existing visual language
- the required output, including a mobile QA note and screenshots or stories when relevant

For route-level work:

- require composed-route Playwright or equivalent runtime verification for runtime-sensitive risks
- if shared mobile UI spans multiple route types, sample at least two representative routes or content densities

Example:

```text
Implement this section mobile-first. Start at 320px, verify 320/375/640/768/1024, verify the composed route directly with Playwright, sample two representative routes if the same mobile header or drawer is shared, verify the mobile nav open/use/scroll/close cycle and the filter drawer open/apply/clear/close cycle, verify short-height states and one worst-case content state, preserve the current visual language, and return a short mobile QA note covering checked interaction cycles, overflow, CTA placement, sticky behavior, short-height mobile risks, confirmed findings, likely risks, and any remaining assumptions.
```

### Review Prompt Shape

Include:

- exact scope
- required viewport matrix
- requested absolute `1-10` severity scoring
- request to separate confirmed issues from likely risks
- request to name the triggering viewport for each finding
- request to verify and name the interaction cycle when runtime verification is needed
- request short-height state checks when the UI uses drawers, sheets, sticky bars, fixed navigation, dialogs, or full-height panels
- request worst-case content-state checks when the layout depends on content shape
- any relevant repo-specific hotspots from the list below
- request to call out touch, overflow, and content-hierarchy problems explicitly

For route-level or shared mobile UI:

- require composed-route Playwright or equivalent runtime verification for runtime-sensitive risks
- require sampling at least two representative routes or content densities when the same mobile UI spans multiple route types

Example:

```text
Review this UI for mobile-first issues at 320/375/640/768/1024. Score each finding on an absolute 1-10 severity scale. Prioritize broken layout, touch interaction failures, and content hierarchy problems. Use composed-route Playwright for route-level runtime risks, sample two representative routes when shared mobile UI spans multiple route types, separate confirmed issues from likely risks, name the triggering viewport for each finding, verify and name the interaction cycle when runtime verification is needed, check short-height states and worst-case content states when relevant, and include evidence per finding.
```

## Reviewer Routing

Use specialist reviewers in this order when the task is primarily mobile UI quality work:

1. `.codex/agents/mobile-ui-reviewer.toml`
2. `.codex/agents/accessibility-reviewer.toml`
3. `.codex/agents/web-vitals-reviewer.toml` for image-heavy, animation-heavy, or landing-page work

Use the SEO reviewer only when the mobile change also affects crawlable route metadata, headings, or indexation behavior.

## Repo-Specific Hotspots

Pay extra attention to these patterns in this repository:

- header and navigation states that switch between desktop dropdowns and mobile accordions
- landing-page sections with sticky or scrollytelling behavior
- listing, comparison, and filter layouts that become dense quickly on narrow screens
- image-heavy clinic detail and blog layouts where `sizes` hints must match real breakpoints

## Good vs. Weak Instructions

Good:

```text
Update the mobile nav behavior first. Verify 320/375/640/768/1024, verify the composed route with Playwright, check the nav open/use/close cycle, avoid hover-only affordances, and include a mobile QA note describing any remaining drawer-height, short-height viewport, or scroll-lock risks.
```

Weak:

```text
Make it responsive and nice on mobile.
```

Good:

```text
Review this landing section for mobile hierarchy problems. Focus on CTA placement, text wrapping, sticky overlap, short-height viewport behavior, and image sizing on 320/375/640/768/1024 widths before discussing desktop polish.
```

Weak:

```text
Check whether the layout could be improved.
```
