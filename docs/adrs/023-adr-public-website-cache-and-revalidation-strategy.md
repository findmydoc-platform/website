# ADR: Public Website Cache and Revalidation Strategy

## Status (Table)

| Name    | Content            |
| ------- | ------------------ |
| Author  | Sebastian Schuetze |
| Version | 1.0                |
| Date    | 05.07.2026         |
| Status  | accepted           |

## Background

findmydoc uses Next.js App Router, Payload CMS, Vercel, public discovery surfaces, Draft and Live Preview, and PostHog-governed analytics. Public website content can appear on detail routes, list routes, global layout areas, generated discovery files, and composed pages such as clinic profiles or Listing Comparison.

The repository already contains several related decisions and strategy documents:

- [ADR 010](./010-structured-logging-approach.md) defines structured logging.
- [ADR 019](./019-adr-posthog-event-taxonomy-and-usage-governance.md) defines PostHog event taxonomy and privacy governance.
- [ADR 022](./022-adr-public-localization-routing-seo-and-domain-strategy.md) requires cache and revalidation behavior to become locale-aware during localization work.
- [Public Discovery Strategy](../public-discovery-strategy.md) defines indexable public surfaces, canonical URL behavior, sitemap freshness rules, and the boundary between operational discovery monitoring and product analytics.

The current cache and revalidation behavior has grown through route-level, hook-level, and helper-level implementation. Some routes use path revalidation, some data reads use tag-based caching, some list and discovery surfaces rely on time-based behavior, and Preview/Admin/Auth flows stay outside persistent public caching.

This ADR defines the architecture rule for public website cache and revalidation behavior.

## Problem Description

CMS-backed public content needs predictable freshness after changes in Payload. Without a shared cache policy, implementation can drift in three ways:

- stale public content can remain visible because a cached data read has no matching invalidation owner
- list, sitemap, discovery, and composed surfaces can be missed when only a detail path is revalidated
- Redis or another shared cache layer can be introduced before the team has defined what must be fresh, what may be stale, and which code owns invalidation

The decision must make it clear which website areas are critical, which may tolerate bounded staleness, which are private/live-only, and which scaling problems remain deliberately deferred.

## Decision Criteria

The chosen strategy must:

- keep public website freshness predictable for patients, search engines, editors, and operators
- distinguish critical public facts from bounded-staleness aggregations
- support composed clinic detail pages that depend on related collections
- avoid treating arbitrary query variants as individual path-cache entries
- keep Preview, Draft, Admin, Auth, and private data out of persistent public caches
- preserve the public discovery and PostHog governance boundaries
- support future locale and domain dimensions without requiring them everywhere in the first implementation
- defer Redis or remote cache storage until there is a scale, coordination, or expensive-aggregation reason
- make invalidation observable through operational logs or internal dashboard visibility before product analytics events are considered

## Considerations

1. Cache nothing persistently
   - Pros: simplest freshness model and no invalidation drift.
   - Cons: increases runtime load on Payload and the database, weakens performance, and does not match the existing Next.js/Vercel architecture.

2. Cache entire pages by path only
   - Pros: easy to understand for simple detail routes.
   - Cons: misses shared data, globals, lists, sitemaps, and composed clinic pages where one source change can affect many public outputs.

3. Cache all Payload-backed data with generic tags
   - Pros: creates a uniform technical rule.
   - Cons: hides product freshness differences, risks caching private or preview data, and still fails unless each tag has a matching invalidation owner.

4. Introduce Redis or another shared cache first
   - Pros: can help with multi-instance coordination, locks, dedupe, and expensive aggregations.
   - Cons: does not solve unclear freshness rules and can make invalidation drift more durable.

5. Use cache classes with a tag-first, path-second invalidation model (chosen)
   - Pros: separates product risk from implementation mechanics, covers shared and composed data, keeps Redis deferred, and gives runtime work a stable policy boundary.
   - Cons: requires a small policy layer, a revalidation planner, and tests that prove each cached surface has an invalidation owner.

## Decision with Rationale

findmydoc uses a classified public website cache and revalidation model.

The governing principle is:

```text
Policy first, invalidation second, storage third.
```

This decision has five parts:

- public website areas use the cache classes below
- shared and aggregated data is invalidated tag-first
- concrete public detail routes are additionally invalidated path-second
- cacheable Payload-backed public reads need an invalidation owner
- Redis and other remote cache storage are deferred until scale or coordination requires them

Public website areas are classified before runtime changes are made. Implementations must not choose cache class, freshness expectation, tag behavior, or invalidation ownership ad hoc while editing runtime code.

### Cache Classes

The accepted cache classes are:

| Cache class | Meaning | Default direction |
| --- | --- | --- |
| `critical-public` | Stale output can mislead users, damage trust, or break canonical SEO state. | Event-driven invalidation; combine path and tag when needed. |
| `shared-public` | Data appears across many public routes. | Tag-first invalidation. |
| `aggregated-public` | Lists, landing blocks, comparison data, sitemaps, and discovery surfaces. | Tag-first with explicitly tolerated short staleness. |
| `private-live` | Admin, preview, draft, auth, private, or personalized state. | No persistent public cache. |
| `operational-scaling` | Bulk imports, expensive shared computations, locks, dedupe, or cross-instance coordination. | Keep local/simple first; defer Redis/runtime-cache decisions unless needed. |

These classes are the required vocabulary for public cache and revalidation decisions.

### Invalidation Model

The default model is **tag-first, path-second**:

- Shared data and aggregations are invalidated through explicit tags.
- Concrete public detail routes are additionally invalidated by public path.
- Every cacheable Payload-backed public read must have an explicit cache class and matching invalidation owner.
- Ungoverned cache helpers are not allowed to imply freshness unless their tags are invalidated by the accepted owner.

The implementation must introduce a central revalidation planner or equivalent policy boundary. Payload collection hooks, global hooks, redirect hooks, seed/bulk flows, and future related-collection hooks should route invalidation decisions through that planner instead of each call site inventing tags and paths independently.

The planner computes affected tags and paths from stable inputs such as collection, operation, document id, slug, previous slug, publish status, and future locale/domain context.

### Tag Naming

Cache tag names must be stable, normalized, and structurally able to include future locale and domain dimensions.

The first implementation stack does not need to populate locale or domain segments everywhere when there is no real runtime context yet. It must not choose a naming pattern that blocks later locale-aware and domain-aware cache invalidation.

Recommended tag families include:

```text
entity:<collection>:<id>
slug:<collection>:<slug>
collection:<collection>
global:<slug>
surface:<name>
surface:sitemap:<name>
```

Future dimensions should extend these tags rather than replacing the convention, for example with locale or domain suffixes.

### Public Discovery And SEO Surfaces

Public discovery surfaces are part of the cache strategy. Sitemaps, `robots.txt`, `llms.txt`, canonical/noindex policy, and future metadata outputs must follow the same freshness model as other public areas.

The public discovery strategy remains the source of truth for what is indexable, what is canonical, and which public facts may appear in discovery outputs. Cache behavior must not invent freshness signals, timestamps, or structured data that are not source-backed.

### Preview, Draft, Admin, Auth, And Private Data

Preview, Draft, Admin, Auth, and private or personalized data are `private-live`. They are not persistent public-cache entries and must not be reused across public users.

Preview means editors see source-backed working state. It does not mean the public cache has already been refreshed.

### Media

Media does not receive one standalone public cache class. Media inherits the cache class of the public area where the media is visible.

The first implementation stack does not require a full generic reverse-dependency graph across blocks, rich text, relations, galleries, and indirect clinic data. Direct media dependency resolution should be handled as a bounded follow-up after the planner and known field map exist.

### Seed And Bulk Imports

Seed and bulk import flows are `operational-scaling`. They should avoid per-record public revalidation storms during a run and should flush affected public tags and paths after completion through the same planner model.

### Analytics And Observability

Cache invalidation, crawler discovery, sitemap freshness, and revalidation decisions are operational observability first.

They should start as structured server logs and internal dashboard-ready visibility, not as new PostHog business events. If a future operator-facing cache action becomes a product analytics event, it must follow [ADR 019](./019-adr-posthog-event-taxonomy-and-usage-governance.md) before capture.

### Redis And Remote Cache Storage

Redis, custom cache handlers, and other remote cache storage are deferred from the first implementation stack.

They are allowed later for:

- cross-instance or multi-region cache coordination
- expensive shared aggregations
- webhook or import dedupe
- locks
- rate limits
- external API response caching

They must not be introduced to compensate for unclear tag names, missing invalidation owners, or unresolved freshness expectations.

## Relationship To Existing Decisions

This ADR complements ADR 010 by requiring cache and revalidation decisions to be observable through structured operational logging.

This ADR complements ADR 019 by keeping cache mechanics out of PostHog business analytics unless a future governed event explicitly needs them.

This ADR complements ADR 022 by requiring tag naming and invalidation policy to support future locale and domain dimensions.

This ADR consumes the Public Discovery Strategy by treating discovery files, canonical/noindex policy, sitemap output, and `llms.txt` as public surfaces with explicit cache classes.

## Technical Debt

The current implementation contains cache and revalidation behavior that predates this policy. Runtime work needs to align or remove helpers, hooks, tags, and route behavior that do not match this ADR.

Known cleanup areas include:

- replacing ad hoc tag/path invalidation with a planner-owned policy boundary
- removing or replacing cache helpers that imply invalidation that is not actually owned
- adding list, sitemap, discovery, and composed clinic-surface invalidation where currently missing
- making seed and bulk import invalidation explicit and batched
- adding operational logs and a minimal dashboard-ready visibility path
- creating a backlog issue for bounded direct media dependency resolution

## Risks (Optional)

- Cache classes can become too broad and hide route-specific behavior.
  - Mitigation: keep area assignments explicit and require tests per affected area.
- Tags can drift if each hook builds them manually.
  - Mitigation: centralize tag/path construction and route all invalidation planning through one planner boundary.
- Redis can be added too early and obscure policy bugs.
  - Mitigation: keep remote cache storage deferred until a later scale or coordination need is documented.
- Discovery output can imply freshness that did not happen.
  - Mitigation: follow the public discovery strategy and use only source-backed freshness signals.
- Direct media changes can remain stale on referencing pages.
  - Mitigation: document first-stack behavior and create a bounded follow-up issue for media dependency mapping.
## Superseded by (Optional)

Not superseded.
