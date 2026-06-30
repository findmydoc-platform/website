# Trust Disclosure UI Playbook

This playbook is the repository-local reference for public trust, conversion, and disclosure UI. Keep hard rules in the nearest relevant `AGENTS.md` file and use this document for source rationale, heuristics, and prompt scaffolding.

## Purpose

Use this playbook when designing or reviewing public pages that show clinic trust, medical safety, verification, review, accreditation, language, price, or provider-quality information.

The goal is to keep primary trust signals visible and readable while moving supporting detail into accessible disclosure patterns that do not overload the page.

## Source Principles

- NN/g's trust guidance emphasizes professional design, upfront disclosure, complete information, and visible external or evidence-based signals.
- NN/g's progressive disclosure guidance supports revealing advanced or supporting detail gradually when the default view remains understandable.
- Baymard's product-page research cautions against hiding decision-critical content in tabs or other low-discoverability containers.
- Google's structured data policies require markup to represent user-visible page content.
- WAI-ARIA dialog guidance requires modal dialogs to manage focus, keyboard dismissal, and focus return.
- Material Design bottom sheets are appropriate for supplementary mobile content when they preserve the user's current task context.

## Page Hierarchy

- Keep the primary trust signal visible in the page flow when it can affect user confidence or conversion.
- Prefer compact inline facts, summary rows, or quiet evidence groups over large marketing-style trust clusters.
- Show enough summary value to make disclosure worthwhile, for example `Languages: English, German + 3 more`, not a vague standalone `Details`.
- Link review summaries to the existing review section when the page already has one instead of duplicating detail in a modal.
- Use modals, drawers, popovers, or bottom sheets for full lists, definitions, source context, verification explanations, and secondary evidence.

## Pills and Badges

- Use badges for compact status, category, verification, count, or filter states where the visual treatment improves scanning.
- Do not use pills or badges as the default presentation for factual content, trust evidence, explanations, languages, accreditations, prices, or review metadata.
- Prefer readable text, summary rows, compact lists, or table-like evidence groups when users need to read, compare, or evaluate information.
- Avoid clusters of many pills in public trust or medical-context UI. If more than three or four values are present, show the strongest values inline and move the full list behind a clear disclosure trigger.
- Keep badge styling restrained: small type, low visual weight, semantic color only when it carries meaning, and no oversized decorative badges.
- Badge labels must be independently understandable. Avoid vague labels such as `Trusted`, `Premium`, or `Top` unless the criteria and meaning are visible nearby or available through disclosure.

## Disclosure Behavior

- Essential trust, conversion, or safety information remains available without hover-only interactions.
- Disclosure controls state the value they expand, and the expanded surface keeps the user in the same task context.
- Desktop detail surfaces may use popovers, dialogs, or side panels when the content is short and task-local.
- Mobile detail surfaces should usually use a bottom sheet for supplementary content and a full dialog only when the task requires focused reading or action.
- Any dialog, drawer, popover, or bottom sheet must provide keyboard access, Escape or close behavior, focus return, scroll containment, and short-height mobile resilience.

## Discoverability and SEO

- Structured data, metadata, and machine-readable facts must match equivalent human-readable facts on the page.
- Do not add structured data that claims a public fact only hidden in implementation details or invisible metadata.
- Details that affect user trust can be collapsed, but the page must still show a clear visible summary that the information exists.
- Prefer server-rendered or otherwise accessible disclosure content for public facts that should remain discoverable.

## Prompt Scaffolding

Use this ingredient when asking an agent to design or review public trust UI:

```text
Preserve the current visual language. Keep the primary trust signals visible without badge-heavy or pill-heavy clusters. Use progressive disclosure only for supporting detail such as full language lists, accreditation details, or verification explanations. Disclosure triggers must include the summary value they expand. Verify modal, drawer, popover, or bottom-sheet accessibility, focus return, scroll containment, mobile short-height behavior, and structured-data parity with visible content when relevant.
```

## Source Links

- [NN/g: Trustworthiness in Web Design](https://www.nngroup.com/articles/trustworthy-design/)
- [NN/g: Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [Baymard: Avoid Horizontal Tabs](https://baymard.com/blog/avoid-horizontal-tabs)
- [Google Search Central: Structured Data Policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [WAI-ARIA Authoring Practices: Dialog Modal Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [Material Design: Bottom Sheets](https://m3.material.io/components/bottom-sheets/overview)
