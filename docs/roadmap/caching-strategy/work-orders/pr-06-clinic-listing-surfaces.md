# PR 6 Work Order: Clinic And Listing Surfaces

This work order defines the future PR 6 implementation packet for the public cache and revalidation stack. It is a planning artifact only. It does not implement PR 6 and does not change runtime behavior.

## Summary

PR 6 expands the cache stack to Clinic Detail, Listing Comparison, and the known clinic-visible related collections. It adds tag-backed public Data Cache coverage for the public server data that these surfaces use, while keeping request-bound route state live.

- Branch: `feature/cache-revalidation/06-clinic-listing-surfaces`
- PR title: `fix(collections): invalidate cache stack 6/8 clinic surfaces`
- Base branch: `feature/cache-revalidation/05-redirect-documents`
- Dependency: PR 5 is implemented, validated, reviewer-clean, and based on the accepted PR 1 plan.
- Scope type: clinic/listing runtime cache and hook migration.

PR 6 must not ask the executor to decide cache classes, freshness expectations, invalidation owners, tag families, public/private boundaries, PR order, or reviewer gates.

## Source Inputs

- [ADR 023 - Public Website Cache and Revalidation Strategy](../../../adrs/023-adr-public-website-cache-and-revalidation-strategy.md)
- [Public Cache And Revalidation Implementation Plan](../cache-revalidation-implementation-plan.md)
- [PR 2 Work Order: Cache Policy Map](./pr-02-policy-map.md)
- Future PR 2 `src/utilities/cachePolicy/**` implementation output
- [PR 3 Work Order: Revalidation Planner And Executor](./pr-03-planner-executor.md)
- Future PR 3 `src/utilities/cacheRevalidation/**` implementation output
- [PR 4 Work Order: Core Hooks](./pr-04-core-hooks.md)
- Future PR 4 core-hook and read-side tag implementation output
- [PR 5 Work Order: Redirect Document Reads](./pr-05-redirect-documents.md)
- Future PR 5 redirect document read output
- [ADR 010 - Structured Logging Approach](../../../adrs/010-structured-logging-approach.md)
- [ADR 019 - PostHog Event Taxonomy and Usage Governance](../../../adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md)
- [ADR 022 - Public Localization, Routing, SEO, and Domain Strategy](../../../adrs/022-adr-public-localization-routing-seo-and-domain-strategy.md)
- [Public Discovery Strategy](../../../public-discovery-strategy.md)
- Current Clinic Detail files: `src/app/(frontend)/clinics/[slug]/page.tsx` and `src/utilities/clinicDetail/serverData/**`
- Current Listing Comparison files: `src/app/(frontend)/listing-comparison/page.tsx` and `src/utilities/listingComparison/serverData/**`
- Current landing and sitemap files: `src/app/(frontend)/page.tsx`, `src/app/(frontend)/partners/clinics/page.tsx`, `src/utilities/landing/**`, and `src/app/(frontend)/(sitemaps)/pages-sitemap.xml/route.ts`
- Current collection and hook files: `src/collections/Clinics.ts`, `src/collections/ClinicTreatments/index.ts`, `src/collections/Doctors.ts`, `src/collections/DoctorSpecialties.ts`, `src/collections/Reviews.ts`, `src/collections/Treatments.ts`, `src/collections/MedicalSpecialties.ts`, `src/collections/Cities.ts`, `src/collections/Accreditation.ts`, `src/collections/ClinicGalleryEntries/**`, `src/collections/ClinicTreatments/hooks/**`, and `src/hooks/calculations/updateAverageRatings.ts`

## Objective

Align Clinic Detail and Listing Comparison freshness with ADR 023 by routing their owning collection changes through the PR 3 planner boundary and by adding canonical tag-backed public Data Cache coverage for the public server data these surfaces consume.

PR 6 must make public clinic facts and listing aggregation data invalidatable without caching private, draft, preview, auth, cookie, or patient-specific route state. It also must preserve existing average price and average rating calculations while making the source write events responsible for visible cache invalidation.

## Non-Goals

PR 6 must not:

- add or change cache classes, tag families, freshness policies, invalidation owners, public/private boundaries, PR order, or reviewer gates
- change ADR 023, the PR 1 implementation plan, the PR 2 policy-map contract, the PR 3 planner/executor contract, PR 4 core-hook behavior, or PR 5 redirect behavior
- change rendered Clinic Detail, Listing Comparison, home, partner landing, or sitemap content
- change route `dynamic`, `revalidate`, `force-static`, or `force-dynamic` behavior
- cache patient favorites, cookie consent state, auth state, request headers, cookies, preview state, draft reads, or any personalized data
- enumerate Listing Comparison query variant paths or create a per-query path invalidation matrix
- build broad all-clinic path revalidation for taxonomy changes
- build a generic reverse-dependency graph across all clinic, treatment, specialty, accreditation, gallery, and media references
- implement raw media upload reverse-dependency resolution for `clinicMedia`, `clinicGalleryMedia`, `doctorMedia`, or `platformContentMedia`
- change seed/bulk final flush behavior, public discovery expansion, `llms.txt`, observability UI, dashboard storage, or PostHog events
- add legacy dual-tagging or emit legacy tags from touched PR 6 code
- add Redis, a custom cache handler, remote cache storage, locks, dedupe, or runtime cache persistence

## Fixed Decisions

PR 6 uses these decisions without reopening them:

- Runtime scope: Clinic Detail, Listing Comparison, known clinic-visible related collections, and the directly affected home, partner landing, and Pages sitemap surface tags.
- Data Cache scope: tag-backed public server data for Clinic Detail and Listing Comparison only.
- Route behavior: Clinic Detail and Listing Comparison routes remain `force-dynamic`.
- Public/private boundary: only public, non-draft, non-preview, non-request-bound server data may enter persistent Data Cache.
- Draft behavior: Clinic Detail draft reads stay live and bypass the public cached read.
- Listing query behavior: canonical Listing Comparison route and data tags are invalidated; query variants do not receive independent path invalidation.
- Fanout policy: concrete `/clinics/<slug>` path revalidation happens only when the changed event directly or safely identifies impacted clinic ids and slugs.
- Broad taxonomy policy: Treatments, MedicalSpecialties, Cities, and Accreditation changes use collection and surface tags unless exact impacted clinic paths are safely known.
- Landing dependency policy: Cities, Treatments, and MedicalSpecialties may invalidate `surface:home`, `surface:partners-clinics`, `/`, and `/partners/clinics` where current route usage proves the dependency.
- Sitemap dependency policy: Listing Comparison freshness sources include `surface:sitemap:pages`; PR 6 does not change sitemap route content or discovery policy.
- Bounded relation policy: `clinicGalleryEntries` and Accreditation are included as bounded relation cases.
- Media policy: media inherits the referencing surface, but raw media upload reverse-dependency resolution remains deferred.
- Hook composition: new PR 6 hook adapters are added without replacing existing ownership, validation, average price, or average rating hooks.
- Calculated update policy: source Review and ClinicTreatment events own visible revalidation; updates caused through `context.skipHooks` must not trigger duplicate revalidation.
- Disable guard: new PR 6 hook adapters respect `context.disableRevalidate`.
- Logging: use PR 3 redacted operational logging only; no raw documents, request data, cookies, auth state, form data, secrets, or PostHog events.

The collection coverage is:

- `clinics`
- `clinictreatments`
- `doctors`
- `doctorspecialties`
- `reviews`
- `treatments`
- `medical-specialties`
- `cities`
- `clinicGalleryEntries`
- `accreditation`

## Expected Implementation Shape

The future implementation should extend the existing PR 2 and PR 3 modules, then adapt the owning collection hooks in place.

Planner and policy behavior:

- add or update PR 2 policy entries for Clinic Detail, Listing Comparison, home/partner landing dependencies, Pages sitemap listing freshness, and bounded clinic relation cases when missing
- add PR 3 normalized event types for PR 6 collection events
- keep the planner pure and free of Payload, Next cache APIs, logger utilities, route modules, request objects, environment readers, database clients, and PostHog utilities
- compute canonical tags and paths through PR 2 builders only
- return typed deferred or fail-fast results for direct media dependency resolution and other unmapped public dependencies

Hook adapter behavior:

- add Clinic hook adapters that include clinic id, current slug, previous slug, current status, previous status, and operation when available
- add ClinicTreatment hook adapters that include current and previous clinic ids and treatment ids, and preserve average price hook ordering
- add Doctor hook adapters that include current and previous clinic ids, current and previous public doctor identifiers, and preserve existing ownership hooks
- add DoctorSpecialty hook adapters that resolve the related doctor and clinic before planning when the relation is not already stable enough
- add Review hook adapters that include current and previous clinic, doctor, treatment, status, and review visibility fields, and preserve average rating hook ordering
- add Treatment, MedicalSpecialty, and City hook adapters that use broad collection/surface invalidation plus known home and partner landing paths
- add bounded clinicGalleryEntries and Accreditation hook adapters that revalidate exact clinic paths only when impacted clinic ids and slugs can be safely resolved
- skip planning and execution when `context.disableRevalidate` is set
- skip duplicate planning for hook-triggered calculated updates marked with `context.skipHooks`
- never pass raw Payload docs into the planner; adapters extract stable primitives first

Data Cache behavior:

- wrap only the public, non-draft Clinic Detail server-data read with canonical tags for clinic entity, clinic slug, collection, clinic-detail surface, and known related collection/surface dependencies
- keep Clinic Detail draft reads live and uncached
- keep cookie consent resolution, patient favorite lookup, headers, cookies, and auth-dependent data outside the cached Clinic Detail server-data read
- wrap Listing Comparison server data with canonical tags for `surface:listing-comparison`, relevant collection tags, and normalized listing query inputs
- avoid per-query path invalidation for Listing Comparison query variants
- align the in-process Listing Comparison catalog cache with the public Data Cache behavior without turning it into a separate freshness authority
- include `surface:sitemap:pages` in planner output for Listing Comparison freshness sources while leaving sitemap content and route policy unchanged

Legacy and deferred areas:

- touched PR 6 code must not emit legacy tags such as `pages-sitemap`, `global_landingPages`, or ad hoc clinic/listing tag strings
- `src/hooks/media/revalidateMediaConsumers.ts` remains outside PR 6 unless an existing import must be adjusted because of PR 2 or PR 3 public API shape
- `src/endpoints/seed/**`, `llms.txt`, cache observability UI, and direct media upload reverse-dependency mapping remain for PR 7, PR 8, or follow-up work

## Expected Tests

Add focused unit coverage for planner output, hook adapters, Data Cache tags, and existing calculation-hook preservation.

The tests must prove:

- planner output exists for Clinics, ClinicTreatments, Doctors, DoctorSpecialties, Reviews, Treatments, MedicalSpecialties, Cities, clinicGalleryEntries, and Accreditation
- planner output uses canonical PR 2 tags and paths only
- Clinic publish, update, unpublish, delete, and slug-change events include old and new clinic paths when known
- related collection events revalidate exact clinic paths only when the impacted clinic ids and slugs are safely known
- broad taxonomy changes use collection and surface tags without all-clinic path blasting
- Listing Comparison events invalidate `surface:listing-comparison` and collection tags without enumerating query variant paths
- Cities, Treatments, and MedicalSpecialties events include home and partner landing surface tags and known paths where current route usage proves the dependency
- Listing Comparison freshness sources include `surface:sitemap:pages` without changing sitemap route content
- `context.disableRevalidate` skips planning and execution for every new PR 6 adapter
- `context.skipHooks` prevents duplicate revalidation for calculated average price and average rating follow-up updates
- existing average price and average rating hooks keep their behavior
- Clinic Detail public server data uses canonical Data Cache tags and draft reads bypass persistent public cache
- Listing Comparison server data uses canonical Data Cache tags and stable normalized query keys
- patient favorites, cookie consent state, headers, cookies, auth state, and request-bound data are not cached
- direct media upload reverse-dependency behavior remains deferred
- touched PR 6 code does not emit legacy tags or use legacy dual-tagging

Expected test files include:

- `tests/unit/utilities/cacheRevalidation/**`
- `tests/unit/hooks/revalidateClinicSurfaces.test.ts`
- `tests/unit/hooks/revalidateClinicRelatedCollections.test.ts`
- `tests/unit/hooks/updateAveragePrices.hooks.test.ts`
- `tests/unit/hooks/updateAverageRatings.test.ts`
- `tests/unit/utilities/clinicDetailServerData.contract.test.ts`
- `tests/unit/utilities/listingComparisonServerData.contract.test.ts`
- `tests/unit/app/frontend/clinic-detail.page.test.tsx`
- `tests/unit/app/frontend/listing-comparison.page.test.ts`
- `tests/unit/app/frontend/sitemap.routes.test.ts`

Do not write tests that only duplicate constants. Prefer behavior-focused assertions that fail when a future collection hook bypasses the planner, leaks request-bound data into cache, reintroduces legacy tags, or broadens path revalidation beyond the fixed fanout policy.

## Validation

The future PR 6 implementation must run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm vitest tests/unit/utilities/cacheRevalidation tests/unit/hooks/revalidateClinicSurfaces.test.ts tests/unit/hooks/revalidateClinicRelatedCollections.test.ts tests/unit/utilities/clinicDetailServerData.contract.test.ts tests/unit/utilities/listingComparisonServerData.contract.test.ts tests/unit/app/frontend/clinic-detail.page.test.tsx tests/unit/app/frontend/listing-comparison.page.test.ts tests/unit/app/frontend/sitemap.routes.test.ts --project unit
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
rtk proxy /Users/razorspoint/Library/pnpm/pnpm check
rtk proxy /Users/razorspoint/Library/pnpm/pnpm build
```

Build is required for the future runtime PR because PR 6 changes collection hooks, runtime cache behavior, and public route data dependencies.

For this planning-document PR, only run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
```

## Reviewers

Recommended reviewers for the future PR 6 implementation:

- `security-reviewer` for public/private cache separation, request-bound data exclusion, fail-fast adapter behavior, and raw-data logging boundaries
- `seo-reviewer` for Clinic Detail, Listing Comparison, sitemap freshness tags, canonical query behavior, and public discovery alignment
- `web-vitals-reviewer` for Data Cache behavior, route performance semantics, and avoiding path invalidation storms

Skip UI, accessibility, mobile UI, and Storybook reviewers unless the scope expands into rendered UI or Storybook surfaces.

Reviewers must run only after Sebastian explicitly confirms reviewer execution. Findings must be fixed and reviewers rerun before PR 7 starts, with the stack-wide maximum of three reviewer cycles unless Sebastian approves more.

## Exit Criteria

PR 6 is complete when:

- Clinic Detail and Listing Comparison public server data have tag-backed canonical Data Cache coverage
- Clinic Detail draft, preview, cookie, auth, favorite, header, and request-bound state remain uncached and live
- PR 3 planner coverage exists for all PR 6 collections and bounded relation cases
- collection hooks route through PR 3 public planner/executor APIs without importing `next/cache`
- existing average price and average rating hooks remain behavior-compatible
- `context.disableRevalidate` and `context.skipHooks` policies are implemented and tested
- exact clinic path fanout happens only when impacted clinic ids and slugs are safely known
- broad taxonomy changes do not trigger all-clinic path revalidation
- Listing Comparison query variants do not receive per-query path invalidation
- Home, partner landing, and Pages sitemap surface tags are included where the current dependency map requires them
- sitemap route content, discovery expansion, seed/bulk behavior, direct media upload reverse-dependency resolution, observability UI, Redis, and PostHog events remain outside PR 6
- required tests and validation pass
- applicable reviewers report no remaining findings or documented accepted exceptions

## Stop Conditions

Stop and ask Sebastian before implementing further if:

- ADR 023, the PR 1 implementation plan, or the PR 2-PR 5 outputs appear wrong or incomplete
- a new cache class, tag family, freshness policy, invalidation owner, public/private boundary, PR order, or reviewer gate seems necessary
- Clinic Detail or Listing Comparison cannot be cached without including request-bound, draft, preview, auth, cookie, favorite, or private data
- exact clinic path fanout requires broad reverse lookups or all-clinic path blasting
- a generic media dependency resolver becomes necessary
- direct media upload changes must be handled to keep PR 6 coherent
- Listing Comparison correctness appears to require enumerating query variant paths
- sitemap route content, public discovery expansion, `llms.txt`, seed/bulk final flushing, or observability UI becomes necessary
- runtime behavior requires legacy dual-tagging
- Redis, custom cache handlers, remote cache storage, locks, dedupe, or runtime cache persistence appears necessary
- a PostHog business event becomes necessary
- locale/domain routing or cache dimensions must be introduced to complete PR 6

Do not patch ADR 023, the PR 1 implementation plan, PR 2, PR 3, PR 4, or PR 5 inside PR 6. Those are architecture or predecessor-contract changes and must be handled separately.

## Assumptions

- PR 1 is merged into `main` and remains the operative stack/order/governance source.
- PR 2 creates the pure `src/utilities/cachePolicy/**` contract before PR 6 starts.
- PR 3 creates the `src/utilities/cacheRevalidation/**` planner/executor boundary before PR 6 starts.
- PR 4 aligns core hooks and matching read-side tags before PR 6 starts.
- PR 5 removes `getCachedDocument` drift and keeps redirect behavior outside the clinic/listing scope.
- `clinics.status === 'approved'` is the public Clinic visibility boundary.
- `reviews.status === 'approved'` is the public Review visibility boundary.
- Clinic Detail and Listing Comparison public server-data functions can be split so public cacheable data is separated from request-bound route state.
- Broad taxonomy and Accreditation changes can be represented through collection and surface tags without a generic reverse-dependency graph in PR 6.
- Direct media upload reverse-dependency resolution is a bounded follow-up, not a PR 6 requirement.
- PR 7 expands discovery and seed/bulk behavior after PR 6 is complete and reviewer-clean.
- PR 8 consumes redacted operational outputs for privileged visibility if that scope is still needed.
- The future full-stack execution goal may start PR 6 only after PR 5 is complete and reviewer-clean.
