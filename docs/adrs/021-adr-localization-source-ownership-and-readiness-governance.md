# ADR: Localization Source, Ownership, and Readiness Governance

## Status (Table)

| Name    | Content            |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 20.06.2026         |
| Status  | draft              |

## Background

[ADR 018](./018-adr-native-payload-localization-strategy.md) standardizes native Payload CMS localization for localized content. That decision remains valid, but it was written around `en` as the editorial default baseline and left public routing, SEO, publishing nuance, fallback behavior, and translation operations to later decisions.

findmydoc now needs a public localization model that matches the DACH-first product rollout. German is the public default and source language for the first localization phase. Existing English work remains valuable and becomes the `en` alternative locale instead of being discarded or treated as disposable pilot content.

This decision defines the source-language model, ownership boundaries, and public readiness rules that later routing and SEO decisions depend on. It does not decide the public URL shape, canonical strategy, sitemap output, or `hreflang` behavior.

## Problem Description

Without a clear localization governance model, Product UI Copy and Payload Content can drift into separate source languages, review rules, and fallback behavior. That creates three risks:

- English can remain the implicit source language even though the first public market focus is DACH.
- English public experiences can appear complete while rendering German fallback content.
- Implementation work can mix Product Copy, CMS Content, and Payload Admin Labels without clear ownership.

The project needs a phase-1 model that preserves existing English work, gives German the correct public source role, and defines when a locale version is ready enough for later public routing and indexing decisions.

## Decision Criteria

The chosen model must:

- reflect the DACH-first public product direction
- preserve existing English UI, seed, and pilot content as usable `en` locale work
- prevent misleading public locale experiences that silently show fallback-only content
- keep phase-1 operations small enough for Git and PR review
- keep source formats ready for later mobile exports and managed translation tooling
- keep Product UI Copy, Payload Content, and Payload Admin Labels separate

## Considerations

1. Keep `en` as the source and default locale
   - Pros: matches the current pilot configuration and reduces immediate migration work.
   - Cons: preserves the wrong source-language model for a DACH-first rollout and leaves German feeling like a translation layer instead of the public source.

2. Switch the source/default model to `de` and preserve existing English as `en` (chosen)
   - Pros: matches the public market focus, preserves existing English work, and gives later routing and SEO decisions a clear readiness basis.
   - Cons: requires careful seed and content migration planning so existing English values are preserved instead of overwritten.

3. Decide readiness ad hoc per route or feature
   - Pros: individual teams can move quickly.
   - Cons: creates inconsistent public behavior, weakens SEO governance, and makes fallback rules hard to audit.

4. Introduce a managed translation system or translation dashboard immediately
   - Pros: could centralize workflow and review state.
   - Cons: adds platform and operational overhead before the project has enough active locales, external translators, or translation throughput to justify it.

## Decision with Rationale

German (`de`) is the phase-1 public default and source locale for Product UI Copy and Payload Content. English (`en`) is the first public alternative locale. Turkish (`tr`) is not part of phase 1 and remains future backlog.

Existing English UI strings, seed content, and localized pilot content must be preserved as `en` alternative-locale content when moved into the new source model. German source values may be translated or adapted from that English baseline, but after migration they are reviewed and treated as German source content, not placeholders derived from English.

Product UI Copy and Payload Content have separate ownership:

- Product UI Copy covers reusable interface strings such as labels, buttons, validation messages, form copy, navigation microcopy, empty states, and generic UI text.
- Payload Content covers editorial, SEO-relevant, trust-relevant, conversion-relevant, legal, medical, and domain content owned by the CMS.
- Payload Admin Labels and helper text remain English and are outside the public localization rollout.

Product UI Copy uses a Git-backed, vendor-neutral source format based on ICU-compatible messages plus translation metadata. The source format must support later mobile exports and later managed translation tooling, but phase 1 remains a Git and PR review workflow.

Payload Content uses native Payload Localization as decided in ADR 018. Payload per-locale draft/publish state through `localizeStatus` is the intended readiness signal for localized public content, but only after the installed Payload behavior has been verified with automated tests. If `localizeStatus` is not reliable enough for public readiness, this ADR must be reopened instead of silently replacing it with heuristic-only readiness.

A locale version is public-ready only when the route's required Product UI Copy and all visible localized required Payload Content dependencies are ready in the same locale. Public indexable locale experiences must not render visible fallback-only content.

Fallback content may appear in Preview and Admin Review workflows, but those workflows must explicitly show locale, route or slug/path, and fallback state. Legal, cookie consent, medical, and trust-sensitive content requires complete reviewed locale content before public locale exposure.

## Relationship to ADR 018

This ADR supersedes ADR 018 only where ADR 018 selected `en` as the default editorial baseline and source locale. ADR 018 remains accepted for the native Payload CMS Localization Strategy, including the decision not to build shadow fields, parallel localized collections, or custom translation tables.

This ADR does not directly modify ADR 018. A later ADR can decide the public routing and SEO behavior that consumes the readiness model defined here.

## Non-goals

This ADR does not decide:

- localized public URL structure
- Domain Strategy for `.eu`, `.de`, or `.com`
- canonical, `hreflang`, sitemap, redirect, or language-switcher behavior
- Next.js or web runtime adapter implementation
- concrete Payload schema fields or migration steps
- a managed TMS rollout
- a Payload Admin Translation Dashboard

## Technical Debt

The current repository state still reflects an earlier localization pilot with `en` as the default locale. Moving to the `de` source model requires follow-up planning for seed data, generated types, localized content migration, and route-level public behavior.

The later routing and SEO ADR must consume the readiness model from this ADR instead of defining readiness independently.

## Risks (Optional)

- English pilot content can be lost or overwritten during the source-language reset.
  - Mitigation: treat English migration as preservation work and require reviewable seed/content movement.
- Fallback behavior can hide missing translations during implementation.
  - Mitigation: block public indexable fallback-only experiences and keep fallback visible in Preview/Admin Review.
- `localizeStatus` behavior may not support the intended readiness model in the installed Payload version.
  - Mitigation: verify behavior with tests before using it as the foundation; reopen this ADR if verification fails.
- A Git and PR workflow can become too manual as locale count or translator count grows.
  - Mitigation: reassess managed translation tooling when translation volume, active locales, or external translator participation increases.

## Superseded by (Optional)

Not superseded.
