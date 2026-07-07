# Public Cache And Revalidation Implementation Plan

This document is the stable implementation planning reference for aligning public website caching and revalidation with [ADR 023](../../adrs/023-adr-public-website-cache-and-revalidation-strategy.md).

It is not the ADR, and the ADR does not depend on this document. This plan consumes the accepted ADR and turns it into concrete area assignments and a stacked PR sequence.

## Source Inputs

- [ADR 023 - Public Website Cache and Revalidation Strategy](../../adrs/023-adr-public-website-cache-and-revalidation-strategy.md)
- [ADR 010 - Structured Logging Approach](../../adrs/010-structured-logging-approach.md)
- [ADR 019 - PostHog Event Taxonomy and Usage Governance](../../adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md)
- [ADR 022 - Public Localization, Routing, SEO, and Domain Strategy](../../adrs/022-adr-public-localization-routing-seo-and-domain-strategy.md)
- [Public Discovery Strategy](../../public-discovery-strategy.md)
- [PostHog Integration](../../integrations/posthog.md)

Temporary research and planning notes were consumed while preparing this plan,
but they are not normative inputs for implementation.

## Execution Boundary

Implementation follows the ADR principle:

```text
Policy first, invalidation second, storage third.
```

The first implementation stack does not introduce Redis, custom cache handlers, or remote cache storage. Redis remains deferred for scale, coordination, locks, dedupe, rate limits, external API caching, or expensive aggregations after the local policy and invalidation model are correct.

Every runtime PR must use the cache assignments below. The executor must not choose cache classes, freshness expectations, tag families, or invalidation ownership ad hoc during implementation.

## Execution Model

The stack is planned in three phases:

1. PR 1 lands this central implementation plan, cache assignment matrix, and execution contract.
2. PRs 2-8 are planned manually as individual work orders before runtime implementation starts.
3. Once the work orders for PRs 2-8 are complete, one future execution goal may implement PRs 2-8 sequentially without asking for local implementation decisions.

The future execution goal runs the stack in order: PR 2, then PR 3, then PR 4, through PR 8. Each PR must be completed before the next PR starts: issue, branch, implementation, validation, PR metadata, applicable reviewer runs, reviewer findings, and reviewer reruns.

The execution goal must not skip validation or reviewer gates. "Without asking" means the agent may resolve local implementation mechanics under the fixed architecture; it does not mean the agent may change cache classes, freshness expectations, invalidation owners, tag families, public/private boundaries, PR order, or reviewer gates.

## Cache Classes

| Cache class | Meaning | Implementation direction |
| --- | --- | --- |
| `critical-public` | Stale output can mislead users, damage trust, or break canonical SEO state. | Event-driven invalidation; combine path and tag when the area is rendered at a public route and reused as data. |
| `shared-public` | Data appears across many public routes. | Tag-first invalidation. Path invalidation is only added when a specific public route must be regenerated. |
| `aggregated-public` | Lists, landing blocks, comparison data, sitemaps, and discovery surfaces. | Tag-first invalidation with explicitly tolerated short staleness. Avoid arbitrary query-path matrices. |
| `private-live` | Admin, preview, draft, auth, private, or personalized state. | No persistent public cache. Keep request-bound or draft/preview-bound. |
| `operational-scaling` | Bulk imports, expensive shared computations, locks, dedupe, or cross-instance coordination. | Keep local and deterministic first; batch invalidation through the planner; defer Redis/runtime-cache storage. |

## Tag Families

Runtime code should centralize tag construction instead of building strings in hooks.

| Tag family | Purpose | Example |
| --- | --- | --- |
| `entity:<collection>:<id>` | One Payload document or record. | `entity:posts:123` |
| `slug:<collection>:<slug>` | Public slug lookup and slug-change invalidation. | `slug:posts:clinic-checklist` |
| `collection:<collection>` | Collection-level lists or derived outputs. | `collection:posts` |
| `global:<slug>` | Payload Global data. | `global:header` |
| `surface:<name>` | A rendered public area or composed route. | `surface:home` |
| `surface:sitemap:<name>` | Sitemap outputs. | `surface:sitemap:pages` |
| `surface:discovery:<name>` | Other discovery outputs. | `surface:discovery:llms` |

Future locale and domain dimensions extend these tags; the first stack does not need fake locale/domain values where the runtime has no real context.

## Revalidation Ownership Model

The implementation introduces a planner-owned policy boundary. Collection hooks, global hooks, redirect hooks, seed/bulk flows, and future related-collection hooks call the planner with stable inputs; the planner returns tags, paths, and log metadata.

The planner owns:

- tag construction
- public path construction
- old and new slug handling
- publish, unpublish, delete, and soft-delete behavior
- known related-collection impacts
- seed and bulk flush planning
- operational log payload shape

Direct calls to `revalidatePath` and `revalidateTag` stay inside the planner or a small executor layer called by the planner. Existing call sites should stop inventing tags and paths independently.

## Operational Observability Boundary

Cache and revalidation visibility is operational observability, not product analytics. Planner and executor log payloads must follow [ADR 010](../../adrs/010-structured-logging-approach.md) redaction rules and include only the non-sensitive identifiers needed to debug invalidation decisions.

The planner and cache visibility surfaces must not log or expose raw request payloads, secrets, tokens, cookies, auth session data, form submissions, patient-specific data, private route data, draft or preview document content, or unrelated CMS field values. The future PR 8 inspector or dashboard-ready component must be visible only to appropriately privileged platform-staff roles. If it is rendered inside a shared admin UI, the access check must happen before operational log data is read.

The PR 8 work order must define the exact access-control check, log payload fields, redaction expectations, and tests for those boundaries before implementation starts.

## Autonomy And Drift Guard

Future implementation agents may make local implementation decisions without asking Sebastian when those decisions do not change cache class, freshness expectation, invalidation owner, tag family, public/private boundary, PR order, or reviewer gate.

If implementation details are ambiguous, agents must resolve them in this order:

1. Follow [ADR 023](../../adrs/023-adr-public-website-cache-and-revalidation-strategy.md).
2. Follow this implementation plan's cache assignment matrix.
3. Follow the current PR work order.
4. Follow existing repository patterns and tests.
5. Choose the smallest behavior-preserving implementation that satisfies the assigned cache policy.

Agents document relevant local decisions in the PR body or work-order completion notes. Work orders may refine implementation details, but they must not change the architecture decisions in ADR 023 or this implementation plan.

## Cache Assignment Matrix

### Public Routes And Surfaces

| Area | Current files | Cache class | Freshness behavior | Invalidation type | Owner |
| --- | --- | --- | --- | --- | --- |
| CMS page detail routes, including `/` for `home` and `/(pages)/[...slug]` | `src/app/(frontend)/(pages)/[...slug]/page.tsx`, `src/collections/Pages/**` | `critical-public` | Immediate to very fast after publish, unpublish, delete, and slug change. | Path-second for the concrete public route; tag-first for `entity:pages:<id>`, `slug:pages:<slug>`, `collection:pages`, and `surface:sitemap:pages`. | Pages hook through planner. |
| Post detail routes `/posts/[slug]` | `src/app/(frontend)/posts/[slug]/page.tsx`, `src/collections/Posts/**` | `critical-public` | Immediate to very fast after publish, unpublish, delete, and slug change. | Path-second for `/posts/<slug>`; tag-first for `entity:posts:<id>`, `slug:posts:<slug>`, `collection:posts`, and `surface:sitemap:posts`. | Posts hook through planner. |
| Blog index `/posts` and pagination `/posts/page/[pageNumber]` | `src/app/(frontend)/posts/page.tsx`, `src/app/(frontend)/posts/page/[pageNumber]/page.tsx` | `aggregated-public` | Bounded staleness is acceptable; publish, unpublish, and delete should refresh list membership faster than the 10 minute route TTL. | Tag-first for `surface:posts-list` and `collection:posts`; revalidate known list paths when membership changes. | Posts hook through planner. |
| Clinic detail routes `/clinics/[slug]` | `src/app/(frontend)/clinics/[slug]/page.tsx`, `src/utilities/clinicDetail/serverData/**`, `src/collections/Clinics.ts` | `critical-public` | Immediate to very fast for approved/public clinic facts, slug changes, status changes, and trust-relevant visible facts. | Path-second for `/clinics/<slug>`; tag-first for `entity:clinics:<id>`, `slug:clinics:<slug>`, `collection:clinics`, and `surface:clinic-detail:<id>`. | Clinics hook through planner. |
| Clinic detail related data | `src/utilities/clinicDetail/serverData/**`; collections listed below | `critical-public` where visible on clinic detail | Immediate to very fast when visible clinic-detail facts change. | Tag-first for impacted clinic aggregate tags; path-second for impacted clinic routes when the related clinic is known. | Related collection hooks through planner. |
| Homepage `/` landing composition | `src/app/(frontend)/page.tsx`, `src/globals/LandingPages/**` | `aggregated-public` with embedded `critical-public` facts where present | Timely; short staleness is acceptable for composed landing content and latest posts, while referenced critical facts keep their own stricter ownership. | Tag-first for `surface:home`, `global:landingPages`, `collection:posts`, `collection:medical-specialties`, and `collection:cities`; path-second for `/` when landing global changes. | LandingPages, Posts, MedicalSpecialties, Cities through planner. |
| About route `/about` | `src/app/(frontend)/about/page.tsx`, `src/globals/LandingPages/**` | `aggregated-public` | Timely; current route TTL is 10 minutes, but landing global updates should refresh the route. | Tag-first for `surface:about` and `global:landingPages`; path-second for `/about` on landing global changes. | LandingPages global hook through planner. |
| Clinic partner landing `/partners/clinics` | `src/app/(frontend)/partners/clinics/page.tsx`, `src/globals/LandingPages/**` | `aggregated-public` | Timely; current route TTL is 10 minutes, but landing global and registration category updates should refresh dependent output. | Tag-first for `surface:partners-clinics`, `global:landingPages`, `collection:posts`, `collection:medical-specialties`, and treatment category dependencies; path-second for `/partners/clinics` on landing global changes. | LandingPages, Posts, MedicalSpecialties, Treatments through planner. |
| Listing Comparison canonical route `/listing-comparison` | `src/app/(frontend)/listing-comparison/page.tsx`, `src/utilities/listingComparison/serverData/**` | `aggregated-public` | Bounded staleness is acceptable, target 1-5 minutes for composed listing data. | Tag-first for `surface:listing-comparison`, `collection:clinics`, `collection:clinictreatments`, `collection:reviews`, `collection:treatments`, `collection:medical-specialties`, and `collection:cities`; no arbitrary path matrix. | Listing-relevant collection hooks through planner. |
| Listing Comparison query variants | `src/app/(frontend)/listing-comparison/page.tsx`, `src/features/searchIndexing/**` | `aggregated-public` | No independent public path freshness promise per query variant. | No per-query path invalidation. Use canonical route policy plus data-level TTL/tags. | Listing data layer and planner-owned surface tags. |
| Contact and registration public form pages | `src/app/(frontend)/contact/page.tsx`, `src/app/(frontend)/register/clinic/page.tsx`, `src/app/(frontend)/register/patient/page.tsx` | `aggregated-public` for public copy, `private-live` for submissions | Public static/copy areas may be timely; submitted form data is not public-cache material. | Public copy follows route/global dependencies if introduced; submissions do not enter public cache invalidation. | Route owners and form bridge owners. |
| Patient favorites and auth-dependent routes | `src/app/(frontend)/patient/favorites/page.tsx`, auth/reset/invite/login/logout routes | `private-live` | Request-bound and user-specific. | No persistent public cache; no public revalidation planner ownership except shared chrome. | Auth/favorites route owners. |
| Admin and Payload routes | `src/app/(frontend)/admin/**`, `src/app/(payload)/**` | `private-live` | Live/admin-bound. | No persistent public cache; internal dashboard widgets may read operational logs later. | Admin/dashboard owners. |
| Preview and draft routes | `src/app/(frontend)/next/preview/route.ts`, `src/app/(frontend)/next/exit-preview/route.ts`, route draft reads | `private-live` | Editors see source-backed working state; this does not imply public cache freshness. | No public cache invalidation; preview remains draft/request-bound. | Preview route owners. |

### Globals

| Global | Current files | Cache class | Freshness behavior | Invalidation type | Owner |
| --- | --- | --- | --- | --- | --- |
| Header | `src/globals/Header/**`, `src/app/(frontend)/layout.tsx` | `shared-public` | Very fast. Header appears across public chrome. | Tag-first with `global:header`; path invalidation only if a route-specific render requires it. | Header global hook through planner. |
| Footer | `src/globals/Footer/**`, `src/app/(frontend)/layout.tsx` | `shared-public` | Very fast. Footer appears across public chrome. | Tag-first with `global:footer`; path invalidation only if required. | Footer global hook through planner. |
| LandingPages | `src/globals/LandingPages/**`, landing routes | `aggregated-public` | Timely; should refresh `/`, `/about`, and `/partners/clinics` on updates. | Tag-first with `global:landingPages` and relevant surface tags; path-second for known landing routes. | LandingPages global hook through planner. |
| CookieConsent | `src/globals/CookieConsent/**`, `src/app/(frontend)/layout.tsx`, clinic detail page | `shared-public` with request-bound consent state | Config should update very fast; individual consent state remains request/cookie-bound and private. | Tag-first with `global:cookieConsent`; public route path invalidation only if config rendering requires it. | CookieConsent global hook through planner. |

### Collections

| Collection | Public dependency | Cache class impact | Freshness behavior | Invalidation type | Owner |
| --- | --- | --- | --- | --- | --- |
| `pages` | CMS page detail routes, fixed public paths, pages sitemap. | `critical-public`, `aggregated-public` for sitemap. | Immediate to very fast for publish, unpublish, delete, slug change. | Entity, slug, collection, sitemap tags; path-second for affected page routes. | Pages hook through planner. |
| `posts` | Post detail, blog lists, homepage/partner teasers, posts sitemap. | `critical-public` for details, `aggregated-public` for lists/teasers/sitemap. | Immediate to very fast for details; bounded staleness for lists but membership changes should trigger list tags. | Entity, slug, collection, posts-list, home/partner surface where latest posts appear, posts sitemap; path-second for details and known list paths. | Posts hook through planner. |
| `clinics` | Clinic detail, Listing Comparison, pages sitemap lastmod via Listing Comparison. | `critical-public` for detail, `aggregated-public` for comparison/sitemap. | Immediate to very fast for approved/public clinic facts; bounded staleness for comparison aggregate. | Entity, slug, collection, clinic-detail surface, listing-comparison surface, pages sitemap. | Clinics hook through planner. |
| `clinictreatments` | Clinic detail treatments, Listing Comparison prices/facets, freshness. | `critical-public` when visible on clinic detail, `aggregated-public` for comparison. | Immediate to very fast for affected clinic details; bounded staleness for comparison aggregate. | Collection tag, listing surface tag, affected clinic-detail aggregate and path when clinic relation is known. | ClinicTreatments hook through planner while preserving average-price hooks. |
| `doctors` | Clinic detail doctors, doctor profile media lookup, review counts. | `critical-public` when visible on clinic detail. | Immediate to very fast for affected clinic detail. | Collection tag plus affected clinic-detail aggregate/path when clinic relation is known. | Doctors hook through planner. |
| `doctorspecialties` | Clinic detail doctor specialty labels. | `critical-public` when visible on clinic detail. | Immediate to very fast for affected clinic detail. | Collection tag plus affected clinic-detail aggregate/path through doctor relation. | DoctorSpecialties hook through planner. |
| `doctortreatments` | Future or indirect doctor/treatment detail dependencies. | `critical-public` only where visible on public clinic detail; otherwise no first-stack public cache owner. | No first-stack visible surface unless route usage proves it. | Add planner case only when public dependency is mapped. | Deferred unless runtime usage needs it. |
| `reviews` | Clinic detail reviews/ratings, Listing Comparison review counts/freshness. | `critical-public` for affected clinic detail, `aggregated-public` for comparison. | Immediate to very fast for approved visible review/ratings; bounded staleness for aggregate comparison. | Collection tag, affected clinic-detail aggregate/path, listing-comparison surface, pages sitemap if freshness changes. | Reviews hook through planner while preserving average-rating hooks. |
| `accreditation` | Clinic detail trust/accreditation display. | `critical-public` when visible through clinic detail. | Immediate to very fast for affected clinic detail when a referenced accreditation changes. | Collection tag; affected clinic-detail aggregate/path only when referencing clinic mapping is available. | Accreditation hook or bounded follow-up mapping through planner. |
| `clinicMedia` | Clinic detail and listing card imagery through clinic thumbnail/media mapping. | Inherits referencing area: `critical-public` on clinic detail, `aggregated-public` on listings. | First stack documents inherited behavior; direct media changes are a bounded follow-up. | Referencing document invalidation first; direct media dependency resolver deferred. | Referencing owner first; media dependency backlog later. |
| `clinicGalleryEntries` and `clinicGalleryMedia` | Clinic detail gallery. | Inherits clinic detail `critical-public`. | First stack documents inherited behavior; direct media dependency resolver deferred. | Referencing clinic/gallery relation invalidation when owner is known; generic reverse lookup deferred. | Referencing owner first; media dependency backlog later. |
| `doctorMedia` | Clinic detail doctor portraits. | Inherits clinic detail `critical-public`. | First stack documents inherited behavior; direct media dependency resolver deferred. | Referencing doctor invalidation first; direct media dependency resolver deferred. | Referencing owner first; media dependency backlog later. |
| `platformContentMedia` | Landing, blog, CMS page, and shared content media. | Inherits referencing surface. | Matches the referencing route or global. | Referencing document/global invalidation first; direct media dependency resolver deferred. | Referencing owner first; media dependency backlog later. |
| `treatments` | Listing Comparison facets, clinic/partner landing categories, clinic treatment labels through relations. | `aggregated-public`, and `critical-public` where label changes affect clinic detail. | Bounded staleness for facets; immediate to very fast when visible clinic detail facts change and impacted clinics are known. | Collection tag, listing-comparison surface, partner/home category surfaces; affected clinic details when relation mapping exists. | Treatments hook through planner. |
| `medical-specialties` | Homepage and partner landing categories, Listing Comparison facets, future discovery. | `aggregated-public`. | Timely; bounded staleness acceptable. | Collection tag, home/partner surfaces, listing-comparison surface. | MedicalSpecialties hook through planner. |
| `cities` | Homepage location options, Listing Comparison facets. | `aggregated-public`. | Timely; bounded staleness acceptable. | Collection tag, home surface, listing-comparison surface. | Cities hook through planner. |
| `countries`, `categories`, `tags` | Public filters, CMS/blog categorization, or future discovery when used. | `aggregated-public` where they shape public lists. | Bounded staleness acceptable unless a category/tag becomes part of a critical canonical route later. | Collection tags and affected list/surface tags where public usage is mapped. | Owning collection hooks through planner only for mapped public dependencies. |
| `favoriteclinics`, `patients`, `basicUsers`, `platformStaff`, `clinicApplications`, `patientClinicInquiries`, `userProfileMedia` | Auth, admin, operational, or submission state. | `private-live` or outside public cache. | No persistent public cache freshness promise. | No public revalidation unless a future public surface is explicitly mapped. | Auth/admin/ops owners. |

### Discovery Surfaces

| Surface | Current files | Cache class | Freshness behavior | Invalidation type | Owner |
| --- | --- | --- | --- | --- | --- |
| `/pages-sitemap.xml` | `src/app/(frontend)/(sitemaps)/pages-sitemap.xml/route.ts` | `aggregated-public` | Timely, target 1-10 minutes; must use source-backed timestamps only. | Tag-first with `surface:sitemap:pages`; planner includes pages, landing/fixed routes, clinics/listing freshness, and other mapped public page sources. | Public discovery and planner owners. |
| `/posts-sitemap.xml` | `src/app/(frontend)/(sitemaps)/posts-sitemap.xml/route.ts` | `aggregated-public` | Timely, target 1-10 minutes; source-backed timestamps only. | Tag-first with `surface:sitemap:posts`; planner includes post publish/unpublish/delete/update. | Posts hook through planner. |
| `robots.txt` | `next-sitemap.config.cjs`, runtime indexing policy | `critical-public` when indexing policy changes | Immediate when preview/public indexing policy changes. | Config/runtime policy, not normal Payload document invalidation. | Public discovery/search indexing owner. |
| `/llms.txt` and `/.well-known/llms.txt` | `src/app/(frontend)/llms.txt/route.ts`, `src/app/(frontend)/.well-known/llms.txt/route.ts`, `src/features/publicDiscovery/**` | `aggregated-public` | Timely, target 1-10 minutes if CMS-backed dependencies are introduced. | Discovery surface tag if CMS-backed; otherwise route policy tests and source file changes. | Public discovery owner. |
| Canonical/noindex policy for Listing Comparison query variants | `src/features/searchIndexing/**`, `src/app/(frontend)/listing-comparison/page.tsx` | `critical-public` for policy correctness, `aggregated-public` for data | Policy correctness should be immediate at deploy/runtime; data remains bounded-stale. | Policy tests; no per-query path invalidation. | Search indexing owner. |
| Structured data outputs | `src/utilities/structuredData/**`, public routes | Mirrors referencing route class | Must not imply hidden facts or invented freshness. | Same owner as referencing route plus public discovery constraints. | Referencing route owner and public discovery owner. |

### Seed, Bulk, And Operational Flows

| Flow | Current files | Cache class | Freshness behavior | Invalidation type | Owner |
| --- | --- | --- | --- | --- | --- |
| Seed endpoint and queued seed runs | `src/endpoints/seed/**` | `operational-scaling` | Avoid per-record public revalidation during a run; flush affected public tags and paths after terminal run states. | Planner-owned batched flush from affected collections/globals. | Seed runner through planner. |
| Baseline seeds | `src/endpoints/seed/baseline/**`, baseline data | `operational-scaling` | Deterministic, production-safe; final flush only for affected public surfaces. | Batched planner output. | Baseline seed owner. |
| Demo seeds | `src/endpoints/seed/demo/**`, demo data | `operational-scaling` | Non-production only; final flush only for affected public surfaces. | Batched planner output. | Demo seed owner. |
| Search sync disabling during seeds | `src/endpoints/seed/utils/**` | `operational-scaling` | Must remain explicit and not hide public revalidation failure. | Keep separate from cache planner; seed context should record disabled per-record sync and final cache flush. | Seed runner owner. |
| Cache inspector / invalidation visibility | Future dashboard widget or dashboard-ready module | `operational-scaling` for ops visibility | Shows recent redacted invalidation decisions to privileged platform-staff roles only; not a product analytics surface. | Reads redacted structured operational logs or planner output history after access control passes. | Developer dashboard/admin owner with platform-staff access control. |

## Invalidation Rules By Operation

| Operation | Required behavior |
| --- | --- |
| Publish or update a public detail document | Invalidate entity, slug, collection, related surfaces, and the concrete public path. |
| Unpublish or soft-delete a public detail document | Invalidate old path, entity, slug, collection, and discovery/list surfaces that may still include the document. |
| Hard delete | Treat as unpublish/delete for public cache purposes and invalidate old public paths and surfaces. |
| Slug change | Invalidate both old and new slug tags and both old and new public paths where both are known. |
| Global update | Invalidate the global tag and all declared public surfaces that consume the global. |
| Related collection update | Invalidate collection/surface tags and impacted owning public detail paths when relation mapping identifies them. |
| Seed or bulk run | Suppress per-record public revalidation during the run and flush all affected public tags and paths at the terminal state. |
| Preview or draft read | Never treat preview freshness as public cache freshness. |

## Validation Baseline

PR 1 is documentation-only and runs `pnpm format` through the repo-supported pnpm 10 binary. It does not require `pnpm check` or `pnpm build` unless the PR scope expands beyond documentation.

All runtime implementation PRs run `pnpm format` through the repo-supported pnpm 10 binary. Runtime PRs also run `pnpm check`. `pnpm build` runs for Next.js, Payload config, routing, admin UI, or output-affecting changes.

Focused tests should be added or updated near the changed behavior:

- `tests/unit/hooks/revalidatePage.test.ts`
- `tests/unit/hooks/revalidatePost.test.ts`
- `tests/unit/hooks/revalidateRedirects.test.ts`
- `tests/unit/app/frontend/sitemap.routes.test.ts`
- `tests/unit/app/frontend/posts.page.test.tsx`
- `tests/unit/app/frontend/posts.page-number.page.test.tsx`
- `tests/unit/app/frontend/listing-comparison.page.test.ts`
- `tests/unit/utilities/clinicDetailServerData.contract.test.ts`
- `tests/unit/utilities/listingComparisonServerData.contract.test.ts`
- `tests/unit/features/searchIndexing/listingComparison.test.ts`
- `tests/unit/features/searchIndexing/sitemapGuards.test.ts`
- `tests/unit/features/publicDiscovery/discoveryContract.test.ts`
- `tests/unit/endpoints/seed/seedEndpoint-success.test.ts`
- `tests/unit/endpoints/seed/import-collection.test.ts`
- `tests/unit/endpoints/seed/globals-seed.test.ts`

Add new unit tests for the planner, tag builders, path builders, and operation mapping. Do not rely on implementation-only tests that duplicate constants without proving a public behavior contract.

## Work Order Readiness

PRs 2-8 must each have a decision-complete work order before the future full-stack execution goal starts. Each work order must define:

- objective
- non-goals
- branch name, PR title, base branch, and dependency
- affected files or areas
- implementation tasks
- required tests and validation commands
- applicable reviewers
- exit criteria
- stop conditions for true external blockers

Work orders may choose local implementation mechanics, but they must not ask the execution agent to decide architecture, cache class, freshness policy, invalidation owner, tag family, PR order, or reviewer gate during implementation.

## Reviewer Contract

Each PR runs local validation first. Then the listed repo-local reviewers run before opening the next PR, once the future full-stack execution goal explicitly authorizes reviewer execution. Reviewer findings are fixed and reviewers rerun until there are no findings left, with a maximum of three reviewer cycles unless Sebastian approves extending the loop.

If a reviewer finding is intentionally not fixed, the PR must document the accepted exception before the next PR starts.

## Final Stacked PR Plan

Each branch is based on the previous branch until the predecessor merges. The first branch is based on `main` that already contains ADR 023 from PR `#1443`.

| Order | Branch | PR title | Base branch | Scope | Affected areas | Validation | Reviewers | Dependency |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `feature/cache-revalidation/01-implementation-plan` | `docs: add cache stack 1/8 implementation plan` | `main` | Land this stable implementation plan. No runtime behavior changes. Do not commit temporary planning brief or research drafts. | `docs/roadmap/caching-strategy/cache-revalidation-implementation-plan.md`; no ADR rewrite. | `pnpm format`; no `pnpm check` or build unless non-doc files change. | `seo-reviewer` for public discovery/cache classification; `security-reviewer` for private/public boundary; skip UI/accessibility/web-vitals/storybook unless files expand. | Starts after ADR 023 is on `main`. |
| 2 | `feature/cache-revalidation/02-policy-map` | `refactor: add cache stack 2/8 policy map` | `feature/cache-revalidation/01-implementation-plan` | Add central cache class, tag-family, public-path, and surface mapping utilities plus tests. Avoid behavior changes beyond replacing local string construction in tests where needed. | New cache policy utilities, test files. | `pnpm format`; targeted planner/tag/path tests; `pnpm check`. Build only if Next/Payload output-affecting files change. | `security-reviewer` for trust boundary and private-live separation; `seo-reviewer` for discovery tag names; `web-vitals-reviewer` if route caching semantics are touched. | Requires PR 1. |
| 3 | `feature/cache-revalidation/03-planner-executor` | `refactor(hooks): add cache stack 3/8 revalidation planner` | `feature/cache-revalidation/02-policy-map` | Add planner and executor boundary for tags, paths, operation mapping, and structured operational log payloads. Keep existing hooks mostly delegated or unchanged until later PRs. | Planner/executor utilities, hook test scaffolding, logging helpers. | `pnpm format`; planner unit tests; hook executor tests; `pnpm check`; `pnpm build` if routing/build output is affected. | `security-reviewer` for server trust boundary; `seo-reviewer` for sitemap/discovery operation mapping; `web-vitals-reviewer` for cache/performance semantics. | Requires PR 2. |
| 4 | `feature/cache-revalidation/04-core-hooks` | `refactor(hooks): route cache stack 4/8 core hooks through planner` | `feature/cache-revalidation/03-planner-executor` | Route Pages, Posts, Header, Footer, LandingPages, CookieConsent, and Redirects through the planner. Replace old tag names with central tag builders and preserve `disableRevalidate` semantics. | `src/collections/Pages/**`, `src/collections/Posts/**`, `src/globals/**`, `src/hooks/revalidateRedirects.ts`, related hook tests. | `pnpm format`; targeted hook tests; affected route tests for posts/pages/sitemaps where changed; `pnpm check`; `pnpm build`. | `security-reviewer`; `seo-reviewer`; `web-vitals-reviewer` if route cache behavior changes. | Requires PR 3. |
| 5 | `feature/cache-revalidation/05-redirect-documents` | `fix(redirects): align cache stack 5/8 redirect document reads` | `feature/cache-revalidation/04-core-hooks` | Resolve redirect target document drift: relation IDs must not be passed to a slug-based cached helper. Remove or replace misleading helpers that imply unowned freshness. | `src/app/(frontend)/_components/PayloadRedirects/**`, `src/utilities/getDocument.ts`, redirect tests. | `pnpm format`; redirect utility/component tests; `tests/unit/hooks/revalidateRedirects.test.ts`; `pnpm check`; `pnpm build`. | `security-reviewer` for redirect safety; `seo-reviewer` for canonical/redirect behavior. | Requires PR 4. |
| 6 | `feature/cache-revalidation/06-clinic-listing-surfaces` | `fix(collections): invalidate cache stack 6/8 clinic surfaces` | `feature/cache-revalidation/05-redirect-documents` | Add planner coverage for Clinics and known clinic-visible related collections: ClinicTreatments, Doctors, DoctorSpecialties, Reviews, Treatments, MedicalSpecialties, Cities, and bounded Accreditation/media behavior. Preserve existing average price/rating hooks. | `src/collections/Clinics.ts`, `ClinicTreatments`, `Doctors`, `DoctorSpecialties`, `Reviews`, `Treatments`, `MedicalSpecialties`, `Cities`, clinic/listing utilities/tests. | `pnpm format`; planner tests per related collection; clinic detail and Listing Comparison contract tests; `pnpm check`; `pnpm build`. | `security-reviewer`; `seo-reviewer`; `web-vitals-reviewer`; `accessibility-reviewer` only if rendered UI changes. | Requires PR 5. |
| 7 | `feature/cache-revalidation/07-discovery-and-seeding` | `fix(seeding): batch cache stack 7/8 discovery flushes` | `feature/cache-revalidation/06-clinic-listing-surfaces` | Cover list and discovery surfaces plus seed/bulk final flush behavior. Ensure sitemaps, `llms.txt` if CMS-backed, Listing Comparison freshness, blog lists, and seed terminal states use planner output. | Sitemap routes/tests, public discovery tests, seed endpoint/utils/tests. | `pnpm format`; sitemap route tests; public discovery tests; seed endpoint/import/global tests; `pnpm discovery:health` when route behavior changes; `pnpm check`; `pnpm build`. | `seo-reviewer`; `security-reviewer`; `web-vitals-reviewer` for cache/performance semantics. | Requires PR 6. |
| 8 | `feature/cache-revalidation/08-observability` | `feat(admin): expose cache stack 8/8 invalidation visibility` | `feature/cache-revalidation/07-discovery-and-seeding` | Add redacted structured operational logs and minimal dashboard-ready cache/revalidation visibility for privileged platform-staff roles. Do not add PostHog business events. Capture backlog issue for direct media dependency resolution. | Logging helpers, developer/admin dashboard widget or dashboard-ready component, docs/tests. | `pnpm format`; focused logging, redaction, and access-control tests; admin/dashboard component tests if UI added; Playwright admin screenshot evidence if rendered admin UI changes; `pnpm check`; `pnpm build`. | `security-reviewer`; `accessibility-reviewer` if UI added; `mobile-ui-reviewer` if responsive admin/public UI changes; `web-vitals-reviewer` if runtime cache diagnostics affect public routes; `seo-reviewer` only for discovery output changes. | Requires PR 7. |

## Issue And PR Requirements

Before creating each PR, open or reuse a GitHub Issue that describes the existing problem or need. Link it in the PR `Development` section. PR descriptions must use the repository template and include validation status for every relevant check.

After PR 1, PRs 2-8 are manually planned as separate work orders. The full-stack execution goal may start only after every PR 2-8 work order is decision-complete.

The PR chain merge order is strict:

```text
1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8
```

Do not open PR `n+1` until PR `n` is locally validated, reviewer-clean, and ready for review or merge according to the execution goal.

## Non-Blocking Follow-Ups

These are not blockers for the first stack:

- direct media dependency resolver for replacing media without republishing referencing documents
- Redis or other remote cache storage for multi-instance coordination
- locale/domain-specific cache population once localized public routing uses real runtime context
- future independently indexable treatment, doctor, location, or specialty route families

## Blocking Uncertainties

No blocking architecture uncertainties remain for the first implementation stack. Any future ambiguity should be treated as a scope exception and escalated before implementation changes the accepted cache class or owner for an affected area.
