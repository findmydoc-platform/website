# Public Discovery Strategy

This document defines the strategic rules for public discovery across SEO and GEO (Generative Engine Optimization / agent discovery). It is intentionally not an implementation guide. Its job is to keep public content crawlable, canonical, and agent-readable without duplicating trust/review policy or localization routing decisions that belong elsewhere.

## Scope And Boundaries

findmydoc public content should be easy for search engines and AI agents to crawl, understand, and cite without exposing private, draft, unpublished, or admin-only data.

Public discovery includes both automated search indexing and user-directed AI retrieval; model training access is a separate consent choice.

`/llms.txt` is a curated agent-context file for public findmydoc orientation. It points agents to canonical public URLs and citation boundaries; it is not a content export, crawler policy, private capability registry, or substitute for public page citations.

Public discovery work supports three outcomes:

- Search engines can discover stable, crawlable, canonical URLs.
- AI agents can identify public entities and source-backed public facts.
- Patients and agents see only public information that already exists in the source data.

This doc does not define:

- Trust claim policy, review governance, moderation rules, or content approval workflows.
- Locale routing, `hreflang`, language-switcher behavior, or translation workflow decisions.
- Product UI copy, legal copy, or medical-copy ownership rules.

## Public Surfaces

An entity becomes independently indexable only when it has a stable public route, enough useful public content, canonical metadata, sitemap inclusion, and clear visibility rules.

The current public entity surfaces are:

- `/clinics/[slug]`: approved clinic profiles; the public slug is the URL identifier.
- `/listing-comparison`: the indexable clinic comparison entry point.
- Published CMS pages and posts.

Doctors, treatments, locations, specialties, tags, and query-filter combinations can support discovery and internal linking, but they are not independently indexable unless a future decision gives them dedicated public routes and sitemap rules.

Public canonical URLs should prefer readable slug routes over query URLs. Query variants remain useful for users, filters, saved links, sorting, and pagination, but they should be canonicalized or marked `noindex` unless they become dedicated landing pages.

Sitemap entries should use real content timestamps when available. Request-time timestamps must not be used as freshness signals because they imply content freshness that did not happen.

Preview, temporary landing, draft, unpublished, private, and admin-only states stay out of public sitemap discovery.

findmydoc observes public discovery traffic only as operational visibility. Platform logs may record recognized crawler classes, the requested public path, platform timestamp, runtime environment, and coarse response context so the team can detect crawl problems, sitemap errors, and agent-discovery drift. This is not product analytics or user behavior tracking. Logs must not capture private content, draft content, admin-only surfaces, cookies, authentication data, contact details, medical free text, IP-based user profiles, or individual user identities.

`/listing-comparison` is the only v1 indexable Listing Comparison URL. It acts as the stable public discovery entry point and is included in `/pages-sitemap.xml`.

Listing Comparison query variants stay functional for users, saved links, filters, sorting, and pagination, but they are not treated as indexable landing pages. Any query parameter on `/listing-comparison` is canonicalized to `/listing-comparison` and emits `noindex, follow`, including current and legacy parameters such as `city`, `specialty`, `treatment`, `ratingMin`, `priceMin`, `priceMax`, `sort`, `page`, `service`, `location`, and `budget`.

Future indexable facets should use dedicated readable slug routes instead of query URLs. Each new route needs a clear search intent, enough stable content and result depth, canonical metadata, and explicit sitemap inclusion before it becomes indexable.

`src/features/searchIndexing/` is the small route-policy foundation for this behavior. It currently provides reusable policy result types, metadata helpers, and the Listing Comparison policy; it is not a full SEO framework or registry.

## Allowed Signals

Freshness signals are source-backed only. Allowed sources include Payload timestamps such as `updatedAt`, publication timestamps such as `publishedAt`, and explicit verification fields that already exist in the public model.

When a public signal does not have a source field, omit it instead of inventing manual freshness, review, or ranking values.

If a signal requires review, moderation, or policy interpretation, define it in the owning trust/review document instead of here.

Structured data is a public facts layer for search engines and AI agents. It should help machines identify the visible page, entity, list, and article facts that patients can already inspect.

Structured data must mirror source-backed public content. It must not introduce hidden ratings, review counts, accreditations, verification claims, medical-quality claims, or recommendation language that is not already visible, moderated, and owned by the relevant trust or medical-content process.

Structured data should stay aligned with the same public-discovery boundaries as canonical URLs, sitemap inclusion, freshness signals, and preview protections. When a page is not a public canonical discovery surface, structured data should not create a parallel discovery signal for it.

## Non-Goals And Links

Use an ADR when a decision changes the architecture of public discovery, such as localized public URL structure, a dedicated public discovery API, new canonical entity route families, or a new structured-data framework.

Relevant docs:

- [ADR 018 - Native Payload CMS localization strategy](./adrs/018-adr-native-payload-localization-strategy.md)
- [Localization ADR decision backlog](./roadmap/localization/localization-adr-questions.md)
- [Payload content localization roadmap](./roadmap/localization/payload-content-localization.md)
- [Trust claim process requirements](../trust-claim-process-requirements-task.md)
- [Trust claim review evidence requirements](../trust-claim-review-evidence-requirements-task.md)

Keep this document as the strategy layer. Do not duplicate ADR rationale, trust-review policy, or localization routing here.
