# ADR: Native Payload CMS Localization Strategy

## Status (Table)

| Name | Content |
| --- | --- |
| Author | Sebastian Schütze |
| Version | 2.0 |
| Date | 29.04.2026 |
| Status | accepted |

## Background

The repository now needs a stable localization model that works inside Payload CMS and can expand without introducing a separate translation architecture.

The first supported locales are `en` and `de`.
`en` is the default editorial baseline because it works as the broadest common language for international patient-facing content and for cross-market reuse.
`de` is included from the start because the current team can author, review, and operate the first rollout safely in German.

Additional locales are expected later.
`tr` is the clearest near-term candidate because of clinic and market relevance, but it is not part of the initial rollout because editorial fluency, review capacity, and developer-side quality control are currently stronger in English and German than in Turkish.

## Problem Description

We need a technical localization strategy that fits Payload as the source-of-truth CMS.

The main decision is not whether the product needs localization, but how localization should be modeled in the content platform.
If we implement a custom translation model on top of Payload, we create parallel schema patterns, extra query logic, custom admin behavior, and additional migration surface.
If we use Payload localization natively, we inherit its data model and constraints, but we keep CMS behavior, APIs, drafts, and fallback semantics aligned with the platform we already run.

## Considerations

1. Keep collections single-language and model translations with custom parallel fields
   - Pros: full control over structure and rollout granularity
   - Cons: duplicates field definitions, increases query and preview complexity, and creates a custom editorial model outside Payload defaults

2. Split localized content into separate locale-specific collections or documents
   - Pros: explicit per-locale isolation and simpler locale-specific publishing rules
   - Cons: duplicated schemas, harder cross-locale consistency, more relation and migration overhead, and weaker reuse of Payload's built-in localization workflow

3. Use native Payload localization as the canonical mechanism for multilingual content (chosen)
   - Pros: built-in admin locale handling, native API support, field-level localization, fallback support, and lower long-term custom maintenance
   - Cons: the Payload localization model becomes part of the repository architecture and still requires separate decisions for URLs, SEO, publishing nuance, and translation operations

## Decision with Rationale

We standardize on native Payload CMS localization for localized content in this repository.

The decision includes the following architectural rules:

- `en` and `de` are the initial supported locales
- `en` is the default locale
- localization is modeled with Payload's native locale system, not with shadow fields, parallel collections, or custom translation tables
- localized and shared fields are decided per content model, with language-independent identifiers and relations remaining shared unless a later decision requires otherwise
- collections can adopt localization incrementally; the first rollout may start with `pages` and `posts`, but the strategy is not limited to those collections

We choose this approach because it keeps the CMS authoring model, local API behavior, draft handling, and fallback semantics inside one platform-native system.
That reduces repository-specific translation plumbing and makes later rollout across more collections more predictable.

We also keep the starting locale set intentionally narrow.
`en` gives the strongest reusable source language for international content.
`de` supports the team's current editorial and operational reality.
This pairing keeps implementation and QA practical while still establishing a real multilingual baseline.

## Technical Debt

Native Payload localization solves content storage and retrieval, but it does not settle every multilingual concern.

The following topics still require separate decisions when they become relevant:

- localized slugs and locale-specific public URL structures
- locale-specific sitemap, canonical, and SEO rules
- per-locale publishing rules or workflow gates
- translation automation, review workflow, and completeness tracking
- expansion order and governance for additional locales such as `tr`

## Risks (Optional)

- Field-level fallback can hide missing translations if editorial workflow treats fallback as completeness.
  - Mitigation: keep translation completeness explicit in editorial guidance and QA.
- A native Payload-first strategy makes later schema changes and locale policy shifts migration-relevant.
  - Mitigation: keep locale scope incremental and document shared-vs-localized field rules per rollout.
- Adding `tr` later is not blocked technically, but language quality and review capacity may become the practical bottleneck.
  - Mitigation: treat new locales as operational rollouts, not only schema switches.

## Superseded by (Optional)

Not superseded.
