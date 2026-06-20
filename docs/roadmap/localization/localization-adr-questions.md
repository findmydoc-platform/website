# Localization ADR Decision Backlog

## Purpose

This document keeps cross-cutting localization decisions that should be captured in a follow-up ADR rather than inside one implementation item. It complements ADR 018, which standardizes native Payload CMS localization but intentionally leaves URL, SEO, runtime, publishing, and translation workflow decision areas open.

## ADR Scope And Locale Matrix

- The next localization ADR is a follow-up to ADR 018. ADR 018 remains valid for native Payload CMS localization.
- The follow-up ADR should supersede ADR 018 only where the older ADR fixed `en` as the default/source locale. It should not supersede the native Payload CMS localization decision itself.
- The ADR should decide routing, SEO, locale runtime behavior, fallback governance, the migration from the current `en` default pilot to the new `de` default target, and the ownership boundary between Product UI Copy and Payload Content Localization.
- The ADR should define the layer-specific locale matrix:
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
- English `/en/...` routes are publicly exposed, linked, indexed, and included in SEO signals only when real reviewed English content exists.
- For normal public page GETs, an English `/en/...` route without ready English content temporarily redirects to the German canonical URL with `302`.
- Indexable English routes must not render visible German fallback values.
- Fallback-only localized routes may support preview and admin review, but they must not be advertised as complete translations and must not create misleading canonical or `hreflang` signals.
- The language switcher preserves route intent and exposes English only when a ready equivalent target route exists.
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

- `/en/...` is not ready: the route temporarily redirects to the German canonical URL, and there is no English canonical URL, `hreflang`, or sitemap entry.
- German and English are ready: both URLs are self-canonical, both have bidirectional `hreflang`, `x-default` points to the German canonical URL, and both appear in the sitemap.
- English content is ready except for a visible German fallback dependency: the English route is treated as not ready and is not indexable.
- A localized slug changes before launch or pilot indexing: no redirect is required.
- A localized slug changes after public indexing: a locale-specific 301 redirect is created.
- Payload `localizeStatus` is verified: locale-published content controls readiness.
- Payload `localizeStatus` is unverified or broken: implementation blocks and the ADR decision is reopened.
