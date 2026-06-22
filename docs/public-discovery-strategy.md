# Public Discovery Strategy

This document defines the strategic rules for public discovery across SEO and GEO (Generative Engine Optimization / agent discovery). It is intentionally not an implementation guide. Feature details live in code, tests, issues, and PRs. Architecture decisions live in ADRs and are linked here instead of repeated.

## Strategic Goal

findmydoc public content should be easy for search engines and AI agents to crawl, understand, cite, and evaluate for freshness without exposing private, draft, unpublished, or admin-only data.

Public discovery work must support three outcomes:

- Search engines can discover stable, crawlable, canonical URLs.
- AI agents can identify public entities, freshness, trust boundaries, and source-backed facts.
- Patients see and agents cite only claims that are backed by source data or an approved operating process.

## SEO And GEO Scope

SEO covers crawlability, canonical URLs, metadata, sitemap inclusion, structured data, internal linking, and indexability.

GEO covers the same public surfaces from an agent perspective: agent-readable context, stable public identifiers, freshness signals, source-backed trust metadata, and content that renders before client-only enhancements.

Both scopes use the same safety rule: public discovery surfaces must never expose private records, admin-only fields, drafts, unpublished records, pending/rejected reviews, or unverifiable medical claims.

## Public Entity Strategy

An entity becomes independently indexable only when it has a stable public route, enough useful public content, canonical metadata, sitemap inclusion, and clear visibility rules.

The current public entity surfaces are:

- `/clinics/[slug]`: approved clinic profiles; the public slug is the URL identifier.
- `/listing-comparison`: the indexable clinic comparison entry point.
- Published CMS pages and posts.

Doctors, treatments, locations, specialties, tags, and query-filter combinations can support discovery and internal linking, but they are not independently indexable unless a future decision gives them dedicated public routes and sitemap rules.

## Canonical And Sitemap Rules

Public canonical URLs should prefer readable slug routes over query URLs. Query variants remain useful for users, filters, saved links, sorting, and pagination, but they should be canonicalized or marked `noindex` unless they become dedicated landing pages.

Sitemap entries should use real content timestamps when available. Request-time timestamps must not be used as freshness signals because they imply content freshness that did not happen.

Preview, temporary landing, draft, unpublished, private, and admin-only states stay out of public sitemap discovery.

## Freshness, Trust, And Review Signals

Freshness signals are source-backed only. Allowed sources include Payload timestamps such as `updatedAt`, publication timestamps such as `publishedAt`, approved patient review dates such as `reviewDate`, and explicit verification fields that already exist in the public model.

Review and trust metadata must describe the source process accurately:

- Approved patient reviews can expose review dates and moderation-backed visibility.
- Clinic verification tiers can be exposed when they come from the public clinic model.
- Clinical or medical review claims must not be emitted unless a real review process and source field exist.

When no source exists, the public surface should omit the signal instead of inventing manual freshness or review values.

## ADR Boundary

This strategy records operating rules and scope boundaries. ADRs record architecture decisions.

Use an ADR when a decision changes the architecture of public discovery, such as localized public URL structure, `hreflang` and locale sitemap behavior, a dedicated public discovery API, new canonical entity route families, or a new structured-data framework.

Relevant ADRs:

- [ADR 018 - Native Payload CMS localization strategy](./adrs/018-adr-native-payload-localization-strategy.md): establishes the current Payload localization foundation and leaves URL, SEO, publishing nuance, and translation workflow decisions to follow-up architecture decisions.

Keep this document as the strategy layer. Do not duplicate ADR rationale here.
