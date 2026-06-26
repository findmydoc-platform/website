# Localization ADR Decision Backlog

## Purpose

This document keeps cross-cutting localization decisions that should be captured in follow-up ADRs rather than inside one implementation item. It complements ADR 018, which standardizes native Payload CMS localization but intentionally leaves URL, SEO, runtime, publishing, and translation workflow decision areas open.

ADR 021 captures source-language, ownership, fallback, and readiness governance. ADR 022 captures public routing, SEO, domain, redirect, sitemap, `hreflang`, and language-switcher behavior.

## ADR Scope And Locale Matrix

- ADR 021 is the first follow-up to ADR 018. ADR 018 remains valid for native Payload CMS localization.
- ADR 021 supersedes ADR 018 only where the older ADR fixed `en` as the default/source locale. It does not supersede the native Payload CMS localization decision itself.
- ADR 022 decides routing, SEO, domain behavior, redirects, locale runtime behavior for public URL resolution, and language-switcher behavior.
- ADR 021 defines the layer-specific locale matrix:
  - Product UI Copy uses `de` and `en`.
  - Payload Content Localization uses `de` and `en`.
  - Payload Admin remains English and is not part of the public localization rollout.
- `de` is the public default and source locale because findmydoc starts with the DACH region.
- `en` is the first public alternative locale.
- `tr` is not part of phase 1. Turkish moves to future backlog and is not planned as data-ready in the first implementation.
- The future mobile app is expected within the next 6-12 months, so source formats must support future mobile exports without implementing mobile runtime delivery in phase 1.

## Public Routing And SEO

- Default-locale public URLs stay unprefixed and serve German content. There is no `/de/...` route in the short-term path-based rollout.
- English public URLs use subpaths such as `/en/...` during the short-term rollout.
- `.eu` remains the short-term German canonical domain.
- The long-term target architecture moves language and market targeting to domains: `.de` serves German/DACH without `/de`, and `.com` serves English/international without `/en`.
- `.eu` must not become a third independent locale or content source. It is migrated later through a planned 301 and canonical migration.
- Localized slugs are planned for all public models that expose localized public URLs, including Pages, Posts, Clinics, Doctors, Treatments, and taxonomy pages. Implementation can still be sequenced by risk.
- Localized public content has its own slug per locale. Slugs are unique per collection and locale. Slug collisions block changes.
- Before launch or pilot indexing, translated slug changes do not require automatic redirect maintenance.
- After public indexing, slug changes create locale-specific 301 redirects.
- Only ready locale versions appear in sitemap output, `hreflang`, alternate links, and indexable locale metadata.
- Each ready locale is self-canonical.
- `hreflang` contains only ready bidirectional alternates plus `x-default` pointing to the German canonical URL.
- Alternative-locale routes are publicly linked, indexed, and included in SEO signals only when real reviewed locale content exists.
- For normal public page GETs, a supported locale URL whose source/default route exists but whose requested locale content is not ready returns HTTP `200` with an explicit translation-unavailable state, `noindex`, no sitemap entry, no `hreflang`, no alternate link, and no visible fallback content.
- Routes that do not exist in the German source/default locale remain normal not-found cases.
- Indexable alternative-locale routes must not render visible German fallback values.
- Fallback-only localized routes may support preview and admin review, but they must not be advertised as complete translations and must not create misleading canonical or `hreflang` signals.
- The language switcher preserves route intent and exposes alternative locales only when a ready equivalent target route exists.
- Preview and draft URLs encode locale, collection, slug/path, and fallback state explicitly through query parameters.

## Routing Research Notes

- Search engines need stable, crawlable URLs per language version for multilingual SEO. Cookie-only or browser-language-only localization is not enough for routing, sharing, `hreflang`, and indexing.
- Subpath routing remains the short-term working assumption because it avoids immediate domain-level operational overhead while making English URLs explicit.
- Domain-based routing is the intended medium- to long-term direction because language and market targeting should eventually map to domains rather than only path prefixes.
- Keeping German unprefixed preserves the main DACH-facing URL shape. Prefixing every locale, including `de`, is more symmetrical but creates unnecessary redirect and migration work for the first rollout.
- References: [Google multi-regional and multilingual sites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites), [Google localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions), [Next.js App Router internationalization](https://nextjs.org/docs/app/guides/internationalization), and [W3C language negotiation guidance](https://www.w3.org/International/questions/qa-when-lang-neg.en.html).

## Locale Resolution And Runtime

- The web runtime is `next-intl` as the Next.js App Router web adapter.
- Product UI Copy remains canonical in vendor-neutral ICU JSON plus metadata. Generated runtime files feed the `next-intl` web adapter.
- The source format must be export-ready for future mobile bundles, but phase 1 implements only the web adapter.
- Message bundles load by current locale and namespace. The app must not ship all locales to every route.
- Public indexable locale resolution is controlled by host and path. The same indexable URL must not render different languages based on cookie or browser language.
- Cookies and browser language can support non-indexable UX such as language suggestions, remembered switcher state, or redirects where SEO rules allow them.
- Query locale is reserved for preview, legacy behavior, and temporary modes.
- Payload Admin Preview passes preview locale explicitly.
- One route locale controls both Product UI Copy and Payload Content. Fallback state is tracked separately instead of allowing UI and content to drift into unrelated locales.

## Payload Content Behavior

- Existing localized Pages and Posts pilot data is not treated as production migration source. The implementation plans a seed-level source reset to `de`: existing English pilot content is preserved as `en` alternative-locale seed content, while German default/source values are translated or adapted from that English baseline and then reviewed as the new source content. English must not remain the implicit source language.
- If real CMS-authored production content exists before rollout, the migration plan must be revisited before changing Payload's default/source locale.
- Public English alternatives require real reviewed English content before indexing or public switcher exposure.
- Phase 1 uses Payload per-locale Draft/Publish via `localizeStatus` as the route readiness signal instead of a custom review dashboard.
- `localizeStatus` is introduced only for models once they are localized and publicly/indexably used. There is no big-bang rollout across all collections.
- A locale route is ready only when the route document and all visible localized required dependencies are ready and published in the same locale.
- Implementation must verify the installed Payload version and automated tests before relying on `localizeStatus`. If `localizeStatus` is not reliable enough, the ADR decision must be reopened instead of silently falling back to heuristics.
- Public data fetching must return ready locale content without visible fallback-only content, or treat the locale route as not ready.
- Preview and Admin Review may show fallback content, but they must make locale, route, slug/path, and fallback state explicit.
- Legal, cookie consent, medical, and trust-sensitive pages must not publicly fallback. They require complete and reviewed locale content before public locale entry or indexing.
- Stable IDs remain canonical for taxonomy filters, analytics, search, and relationships. Localized labels and SEO slugs can vary by locale.
- Metadata, sitemap entries, cache tags, ISR, and revalidation must become locale-aware.

## Translation Operations

- Git plus PR remains the translation workflow for phase 1.
- Reassess an external TMS when a fourth public locale is introduced.
- XLIFF remains a future interchange format only. Phase 1 requires vendor-neutral source data and TMS-ready metadata, not XLIFF import/export.
- Phase 1 completeness reporting uses CI/script output plus documentation tables for missing or stale Product UI Copy and Payload Content gaps.
- No translation dashboard is required in phase 1.

## ADR Test Cases

- `/en/...` is not ready but the German source/default route exists: the route returns HTTP `200` with an explicit translation-unavailable state, `noindex`, no visible German fallback content, and no English sitemap, `hreflang`, or alternate entry.
- German and English are ready: both URLs are self-canonical, both have bidirectional `hreflang`, `x-default` points to the German canonical URL, and both appear in the sitemap.
- English content is ready except for a visible German fallback dependency: the English route is treated as not ready and is not indexable.
- `/en/...` points to a route that does not exist in German source/default content: the route remains a normal not-found case.
- A localized slug changes before launch or pilot indexing: no redirect is required.
- A localized slug changes after public indexing: a locale-specific 301 redirect is created.
- Payload `localizeStatus` is verified: locale-published content controls readiness.
- Payload `localizeStatus` is unverified or broken: implementation blocks and the ADR decision is reopened.
