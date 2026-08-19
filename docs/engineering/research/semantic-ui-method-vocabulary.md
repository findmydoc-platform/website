# Established UI Methods for Website Instructions

Date: 2026-08-19  
Research question: Which established, attributable UI methods correspond to the Website's current component, responsive, accessibility, interaction, and design-system instructions, and which nearby terms must remain distinct?

## Decision summary

Four public methods are strong enough to advance to the UI vocabulary decision:

1. **Mobile First according to Luke Wroblewski** for design order, content priority, and touch-oriented constraint handling.
2. **Responsive Web Design according to Ethan Marcotte** for layouts and media that adapt across viewing contexts.
3. **WCAG 2.2 Level AA** as the versioned accessibility standard against which relevant UI is designed and reviewed.
4. **Atomic Design according to Brad Frost** for the atoms/molecules/organisms/templates/pages design-system hierarchy.

They address distinct concerns and may be composed without becoming an unnamed hybrid. None of them replaces the repository's exact viewport matrix, short-height scenarios, runtime-evidence threshold, component-to-Payload boundary, UI-state inventory, or local component conventions.

No public anchor should replace the current interaction/state rules as a whole. Those rules combine at least four different concerns: finite behavioral transitions, content-shape variants, asynchronous status, and validation outcomes. **Statecharts** is an established formalism for the first concern only; using it as a general synonym for “cover UI states” would change the method and over-prescribe ordinary components.

## Evaluation basis

The Semantic Anchors project defines a useful anchor as **precise, rich, consistent, and attributable**. Its own evaluation guidance also distinguishes recognition from correct application and warns that model-specific activation must be tested rather than assumed ([quality criteria](https://llm-coding.github.io/Semantic-Anchors/about/#quality-criteria), [evaluation dimensions](https://llm-coding.github.io/Semantic-Anchors/evaluations/#evaluation-dimensions)). This report assesses conceptual eligibility and repository fit; it does not prove model behavior.

| Candidate | Precise | Rich | Consistent | Attributable | Recommended role |
| --- | --- | --- | --- | --- | --- |
| Mobile First according to Luke Wroblewski | High with attribution | High | Medium-high | High | Design sequence and prioritization |
| Responsive Web Design according to Ethan Marcotte | High | High | High | High | Cross-viewport layout and media behavior |
| WCAG 2.2 Level AA | High when version and level are named | Very high | High | Very high | Accessibility target and review vocabulary |
| Atomic Design according to Brad Frost | High with attribution | High | High | High | Design-system hierarchy |

The qualifiers matter. “Mobile-first”, “responsive”, “accessible”, and “design system” on their own are commonly used adjectives and can activate weaker or broader meanings. Naming the author or version narrows the prior without adding a local redefinition.

## Repository baseline

The Website already expresses the four methods in long form:

- The mobile playbook starts with narrow-view design, then expands to tablet and desktop, prioritizing content, actions, wrapping, and touch (`docs/frontend/mobile-ai-playbook.md:5-25`).
- Component and route instructions require mobile-first utility composition and responsive checks (`src/components/AGENTS.md:22-26,42-52,64-68`; `src/app/(frontend)/AGENTS.md:21-23,34-35,59-65`).
- Accessibility is a P0 concern, and repository rules make semantics, form errors, keyboard/focus behavior, and ARIA states concrete (`src/components/AGENTS.md:3-7,23-24,54-62`; `.codex/agents/accessibility-reviewer.toml:10-31`).
- Atomic layers are explicit in component instructions, directory structure, story metadata, and a dedicated architecture guide (`src/components/AGENTS.md:9-21`; `docs/frontend/atomic-architecture.md:1-39`; `docs/frontend/story-governance.md:7-25`).
- Interaction coverage currently names concrete cycles and content states rather than a formal modeling notation (`src/components/AGENTS.md:64-68`; `src/stories/AGENTS.md:19-21,51-54`).

This means the opportunity is not to introduce unfamiliar UI doctrine. It is to give established parts of the existing doctrine canonical names while preserving the project's operational details as local contracts.

## Candidate 1: Mobile First according to Luke Wroblewski

### Canonical meaning and origin

Luke Wroblewski's *Mobile First* argues that web products should be designed for mobile before desktop. The method uses mobile constraints to force focus and prioritization, while also considering mobile capabilities and concrete implications for organization, actions, inputs, and layout ([author's 2011 book page](https://www.lukew.com/resources/mobile_first.asp), [book contents](https://lukew.com/mobilefirst/index.html)).

### Boundary versus adjacent terms

- It is a **design order and prioritization method**, not a complete responsive-layout technique.
- It is distinct from **Responsive Web Design**, which explains how one experience adapts across viewing contexts.
- It does not mean “mobile-only”, reduced feature parity, or merely writing `min-width` CSS first.
- It does not specify a viewport test matrix, safe-area behavior, browser-engine coverage, or runtime evidence.

### Website fit

The repository's “narrow viewport first, then widen” sequence and content/action priority are direct applications of Mobile First (`docs/frontend/mobile-ai-playbook.md:5-11`; `src/app/(frontend)/AGENTS.md:21-23`). The same method is repeated in root execution rules and component styling guidance (`AGENTS.md:61-66`; `src/components/AGENTS.md:52`).

### What must remain explicit

Keep the exact `320/375/640/768/>=1024` matrix, conditional `1280` check, short-height scenarios, touch failure modes, exact interaction cycles, representative-route sampling, and the `Confirmed` versus `Likely` evidence rule. These are repository choices, not entailed by Wroblewski's method.

### Assessment

Advance it as **“Mobile First according to Luke Wroblewski”**. Confidence is high on conceptual fit and attribution, but only medium-high on unqualified model consistency because “mobile-first” is also widely used as a CSS implementation shorthand.

## Candidate 2: Responsive Web Design according to Ethan Marcotte

### Canonical meaning and origin

Ethan Marcotte introduced Responsive Web Design in 2010 as the combination of fluid grids, flexible images, and media queries, used to adapt a shared experience across a gradient of viewing contexts ([original A List Apart article](https://alistapart.com/article/responsive-web-design/)).

### Boundary versus adjacent terms

- Responsive Web Design is the **adaptation system**; Mobile First is the **starting sequence and prioritization lens**. One does not imply the other.
- It is not synonymous with a fixed set of device breakpoints or a separate mobile site.
- It does not guarantee accessible keyboard/focus behavior, touch reachability, content priority, performance, or correct full-height overlays.
- “Adaptive design” is often used for selected fixed layouts; it should not silently substitute for Marcotte's fluid model.

### Website fit

The repository requires deliberate widening, resilient wrapping, breakpoint-aware media sizing, and verification across a width continuum (`src/components/AGENTS.md:25-26,42,52,64`; `src/app/(frontend)/AGENTS.md:21-23,59-65`). Those requirements are consistent with Marcotte's fluid-layout, flexible-media, and contextual adaptation model.

### What must remain explicit

Keep repository breakpoints and viewport checks, Tailwind/shadcn conventions, image `sizes` verification, no-essential-hover rule, short-height scenarios, composed-route checks, and local surface tokens. Responsive Web Design cannot select these project-specific values or validation thresholds.

### Assessment

Advance it as **“Responsive Web Design according to Ethan Marcotte”**. Confidence is high: the term is canonical, attributable, technically rich, and closely matches current repo behavior. Its boundary with Mobile First should appear in the eventual vocabulary definition because prompts routinely conflate them.

## Candidate 3: WCAG 2.2 Level AA

### Canonical meaning and origin

WCAG 2.2 is a W3C Recommendation whose technology-neutral success criteria cover accessible web content across desktop and mobile devices. Level AA conformance requires satisfying all Level A and Level AA success criteria, and responsive variations are part of the full page for conformance purposes ([WCAG 2.2 Recommendation](https://www.w3.org/TR/WCAG22/#intro), [conformance levels](https://www.w3.org/TR/WCAG22/#cc1), [full pages](https://www.w3.org/TR/WCAG22/#cc2)).

### Boundary versus adjacent terms

- WCAG is a **normative accessibility standard**, not a component library or a general usability method.
- It is distinct from the WAI-ARIA Authoring Practices, which provide design patterns and examples for particular widgets.
- “ARIA compliant” is not a substitute. W3C's Authoring Practices warn that incorrect ARIA can override or misrepresent native accessibility semantics ([APG: Read Me First](https://www.w3.org/WAI/ARIA/apg/practices/read-me-first/)).
- Passing an automated scanner does not establish WCAG conformance; W3C states that no tool alone can determine whether a site meets accessibility standards and that knowledgeable human evaluation is required ([Evaluating Web Accessibility](https://www.w3.org/WAI/test-evaluate/)).

### Website fit

The current reviewer already concentrates on semantic HTML, names/labels, keyboard flow, focus, dialogs, forms, and ARIA states (`.codex/agents/accessibility-reviewer.toml:12-31`). Public form rules explicitly preserve native constraints and expose inline errors with `aria-invalid` and `aria-describedby` (`src/components/AGENTS.md:59-62`; `src/app/(frontend)/AGENTS.md:50-53`). These are concrete applications within WCAG's scope.

### What must remain explicit

The decision must state whether the phrase means “design/review against applicable WCAG 2.2 A/AA criteria” or a formal conformance target. Do not imply a site-wide compliance claim without full-page evidence. Keep repository component patterns, semantic-HTML preference, manual keyboard/focus checks, affected states/routes, and evidence threshold explicit.

### Assessment

Advance **“WCAG 2.2 Level AA”**, but require a scope verb in every use: for example, “review this changed flow against applicable WCAG 2.2 Level A and AA criteria.” Confidence is very high on definition and attribution, and high on model recognition. Confidence is lower that the bare term alone produces an appropriately scoped review rather than an unsupported compliance claim.

## Candidate 4: Atomic Design according to Brad Frost

### Canonical meaning and origin

Brad Frost defines Atomic Design as a non-linear mental model for interface design systems with five stages: atoms, molecules, organisms, templates, and pages. It supports reasoning about both individual parts and the composed whole ([official methodology chapter](https://atomicdesign.bradfrost.com/chapter-2/)).

### Boundary versus adjacent terms

- Atomic Design classifies interface-system composition; it is not a general software architecture, CSS methodology, state-management method, or data-access policy.
- It does not prescribe React server/client boundaries, Payload isolation, router independence, CVA, Tailwind, or shadcn.
- Frost explicitly treats the stages as a concurrent mental model, not a mandatory linear build process.

### Website fit

The repository already adopts the exact five-stage vocabulary in component folders, story titles/tags, path aliases, and instructions (`docs/frontend/atomic-architecture.md:1-25,41-53`; `docs/frontend/story-governance.md:7-25,36-42`; `src/components/AGENTS.md:9-21`). This is the strongest existing public anchor in the UI instruction set.

There is, however, local semantic drift that an anchor cannot resolve: `docs/frontend/atomic-architecture.md:24` says organisms may accept Payload types, while the closer `src/components/AGENTS.md:28-34` makes all `src/components/**` Payload-free. The layered instruction wins for current work, but the documentation conflict should be reconciled before using the anchor to remove nearby prose.

### What must remain explicit

Keep the repository's precise layer responsibilities, downward import rule, Payload adapter boundary, server/client split, story metadata, component API rules, and local exceptions. Atomic Design supplies names and composition logic, not these contracts.

### Assessment

Advance **“Atomic Design according to Brad Frost”** for layer vocabulary and part-to-whole reasoning. Confidence is high on recognition and direct repo fit. It should replace explanatory layer prose only after the local layer contract is conflict-free; it should never replace that contract wholesale.

## Why Statecharts should not advance as the default state anchor

David Harel introduced Statecharts as a visual formalism for complex systems; the formalism extends simple state-transition diagrams with hierarchy, concurrency, and communication ([Harel publication record and paper](https://www.weizmann.ac.il/math/harel/publications-0)). W3C SCXML provides standardized execution semantics for a related state-machine notation ([SCXML 1.0](https://www.w3.org/TR/scxml/)). It therefore passes the semantic-anchor criteria in its actual domain.

The Website instructions do not currently mandate hierarchical or concurrent state models. They ask for named UI variants, worst-case content, and full interaction cycles (`src/components/AGENTS.md:66-68`; `src/stories/AGENTS.md:19-21,51-54`). Applying Statecharts to every loading, empty, error, disabled, or validation state would add architecture that the current rules do not require.

Recommendation: keep state and interaction requirements explicit or define a small local Semantic Contract later. Use Statecharts only when a genuinely complex reactive flow benefits from explicit states, events, guards, and transitions.

## Recommended composition and non-compressible contract

The later decision ticket should evaluate this composition, not a single umbrella phrase:

> Apply Mobile First according to Luke Wroblewski, Responsive Web Design according to Ethan Marcotte, WCAG 2.2 Level AA, and Atomic Design according to Brad Frost, subject to the Website UI contract.

The **Website UI contract** must continue to name, retrieve, or enforce:

- exact scope and primary user goal;
- viewport and short-height matrix;
- touch, overflow, sticky, virtual-keyboard, and content-shape risks relevant to the change;
- concrete interaction cycles and UI states;
- component-level versus composed-route evidence;
- semantic HTML and local form/control patterns;
- Payload, routing, data-fetching, and server/client boundaries;
- design tokens, component primitives, story governance, and output evidence.

This division is the main compression opportunity: the four anchors can replace repeated explanations of public methods, while a shorter local contract preserves choices that no public method can infer.

## Lean validation for the decision ticket

Use one frozen UI case with an interactive responsive component, such as a filter drawer or public form. Compare the current explicit prompt with an anchor-based prompt that retains the non-compressible Website UI contract. Run both on the main implementation model and the affected UI reviewer model. Score at most five checks:

1. Correctly applies each named method without conflating adjacent methods.
2. Preserves repository architecture and component boundaries.
3. Covers the required interaction states and accessibility behavior.
4. Produces equal or better implementation/review usefulness.
5. Is materially shorter.

Repeat only when the result is unclear or contradictory. This validates the actual purpose of an anchor—reliable activation in the project's model context—without creating a new evaluation platform or CI suite.

## Evidence limits

- The public sources establish canonical definitions and boundaries; they do not prove that every target model activates those definitions consistently.
- Repository evidence establishes current written intent, not runtime UI conformance.
- No implementation output was generated or evaluated in this research ticket.
- The Atomic Design documentation conflict is a current-source inconsistency and lowers confidence in any immediate prose deletion around component boundaries.

Overall confidence: **high** that the four candidates are established, attributable methods matching current Website instructions; **medium** that they can safely shorten prompts before the lean model/application comparison is run.
