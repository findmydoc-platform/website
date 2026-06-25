# ADR: Public Localization Routing, SEO, and Domain Strategy

## Status (Table)

| Name    | Content            |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 20.06.2026         |
| Status  | draft              |

## Background

[ADR 018](./018-adr-native-payload-localization-strategy.md) standardizes native Payload CMS localization for localized content. [ADR 021](./021-adr-localization-source-ownership-and-readiness-governance.md) defines German (`de`) as the phase-1 public default and source locale, English (`en`) as the first public alternative, and `locale-ready` as the readiness boundary for public localized experiences.

The current repository state still reflects an earlier localization pilot. English is the technical default, localized content access can use query parameters, and sitemap plus metadata behavior is not yet locale-aware.

This ADR decides the public URL, SEO, domain, redirect, and language-switcher strategy that consumes ADR-021 readiness. It does not redefine source-language ownership, translation workflow, or Payload Content readiness.

## Problem Description

Public localization needs stable, crawlable, and shareable URLs for each indexable language version. Query-only, cookie-only, or browser-language-only localization is not sufficient for canonical URLs, `hreflang`, sitemap entries, redirects, sharing, or reliable indexing.

Without a clear routing and SEO decision, `.eu` can drift into a third pseudo-locale, English paths can appear indexable before the English experience is ready, and the same public URL can render different languages depending on request state. That would weaken search signals and make public locale behavior hard to audit.

## Decision Criteria

The chosen strategy must:

- preserve DACH-first URL continuity for the German default experience
- give English explicit public URLs when English is ready
- prevent fallback-only locale versions from becoming indexable
- produce correct canonical, `hreflang`, sitemap, and alternate-link behavior
- avoid immediate domain migration work in phase 1
- keep a clean path toward later `.de` and `.com` domain separation

## Considerations

1. Prefix every public locale path, including German
   - Pros: creates symmetrical path rules such as `/de/...` and `/en/...`.
   - Cons: forces unnecessary German URL migration for the primary DACH-facing experience and increases redirect work before the Domain Strategy is ready.

2. Use browser language, cookies, or query parameters for Public Localization
   - Pros: avoids route changes and can support lightweight UX preferences.
   - Cons: does not create stable indexable URLs and can cause a public URL to render different languages.

3. Move immediately to domain-based localization
   - Pros: matches the long-term language and market targeting model.
   - Cons: adds domain, redirect, canonical, and operational migration work before phase-1 content readiness is complete.

4. Keep German unprefixed, serve English under `/en/...`, and migrate domains later (chosen)
   - Pros: preserves German URL continuity, gives English crawlable URLs once ready, keeps phase-1 operational cost lower, and leaves a clear path to `.de` and `.com`.
   - Cons: the short-term path model and the long-term domain model must be connected through a later planned migration.

## Decision with Rationale

German public default URLs remain unprefixed in the short-term path-based rollout and serve German content. English public URLs use `/en/...` when the English locale version is ready. There is no short-term `/de/...` public route.

The `.eu` domain remains the short-term German canonical domain. It must not become a third locale, a separate content source, or an independent market experience. The long-term target is domain-based localization: `.de` serves German/DACH without `/de`, and `.com` serves English/international without `/en`.

The later `.eu` migration requires planned `301` and canonical handling. This ADR decides the target direction and SEO principles, not the execution timeline or redirect table for that migration.

Public indexable locale resolution is controlled by host and path. The same indexable URL must not render different languages based on cookies, browser language, or other request preferences. Cookies and browser language can support non-indexable UX such as suggestions or remembered switcher state, but they are not the source of truth for indexable locale routing.

Query locale is reserved for Preview, legacy behavior, and temporary modes. It must not create indexable public alternate language URLs.

Only locale versions that satisfy ADR-021 readiness may appear in sitemap output, `hreflang`, alternate links, and indexable locale metadata. Each ready locale version is self-canonical. `hreflang` contains only ready bidirectional alternates, and `x-default` points to the German canonical URL.

Public locale URLs for alternative locales are publicly linked, indexed, and included in SEO signals only when the requested locale version satisfies ADR-021 readiness. If a supported locale URL is requested for a route that exists in the German source/default locale, but the requested locale version is not ready, the route does not render fallback content and does not redirect to the German canonical URL. Instead, it renders an explicit translation-unavailable state with HTTP `200`, `noindex`, no sitemap entry, no `hreflang`, no alternate link, and no indexable locale metadata. This state can link to the available German canonical/source page. A route that also does not exist in the German source/default locale remains a normal not-found case.

Localized slugs are the target for public models that expose localized public URLs. Public slugs are unique per collection and locale, and slug collisions block changes. Before launch or pilot indexing, translated slug changes do not require automatic redirect maintenance. After public indexing, slug changes create locale-specific `301` redirects.

The language switcher preserves route intent and exposes alternative locales only when a ready equivalent target route exists. Directly requested not-ready locale URLs can still render the translation-unavailable state.

Preview and Draft URLs must explicitly carry locale, collection, slug or path, and fallback state so preview behavior is not confused with public indexable behavior.

## Relationship to ADR 018 and ADR 021

ADR 018 remains accepted for the native Payload CMS Localization Strategy. ADR 021 defines source-language ownership, fallback governance, and public readiness. This ADR consumes ADR-021 readiness and applies it to public routing, SEO, domain, redirect, sitemap, and language-switcher behavior.

This ADR does not redefine Product UI Copy ownership, Payload Content ownership, translation operations, or `localizeStatus` readiness.

## Non-goals

This ADR does not decide:

- concrete Next.js route group, middleware, or adapter implementation
- Payload schema fields or migration steps
- redirect table contents for the later `.eu` migration
- Product UI Copy source format or translation workflow
- Payload Content readiness mechanics
- a managed TMS rollout or Payload Admin Translation Dashboard

## Technical Debt

The current repository state still uses pilot-era locale behavior and non-locale-aware sitemap or metadata output. Implementing this ADR requires later work on routes, metadata, sitemap, preview, redirect, cache, and revalidation so they become locale-aware.

The later `.eu` migration to `.de` and `.com` requires a separate execution plan with concrete redirect, canonical, analytics, and search-index monitoring steps.

## Risks (Optional)

- Not-ready locale pages can be misunderstood as complete translations.
  - Mitigation: require ADR-021 readiness before locale routes enter navigation, sitemap, `hreflang`, or indexable metadata; directly requested not-ready locale URLs render only a `noindex` translation-unavailable state.
- `.eu` can accidentally become a separate locale or market surface.
  - Mitigation: keep `.eu` only as the short-term German canonical and plan the later migration deliberately.
- Query or cookie locale behavior can leak into public SEO paths.
  - Mitigation: keep host and path as the only indexable locale-resolution inputs.
- Domain migration can create SEO loss if treated as an implementation detail.
  - Mitigation: treat the `.eu` migration as a planned SEO migration with `301`, canonical, and monitoring controls.

## Superseded by (Optional)

Not superseded.
