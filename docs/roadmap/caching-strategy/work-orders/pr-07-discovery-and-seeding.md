# PR 7 Work Order: Discovery And Seeding

This work order defines the future PR 7 implementation packet for the public cache and revalidation stack. It is a planning artifact only. It does not implement PR 7 and does not change runtime behavior.

## Summary

PR 7 aligns public discovery, blog list freshness, and seed/bulk terminal flush behavior with the accepted cache stack. It extends the PR 2 policy map and PR 3 planner only inside the existing ADR 023 and PR 1 architecture.

- Branch: `feature/cache-revalidation/07-discovery-and-seeding`
- PR title: `fix(seeding): batch cache stack 7/8 discovery flushes`
- Base branch: `feature/cache-revalidation/06-clinic-listing-surfaces`
- Dependency: PR 6 is implemented, validated, reviewer-clean, and based on the accepted PR 1 plan.
- Scope type: discovery/list freshness and seed final-flush runtime alignment.

PR 7 must not ask the executor to decide cache classes, freshness expectations, invalidation owners, tag families, public/private boundaries, PR order, or reviewer gates.

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
- [PR 6 Work Order: Clinic And Listing Surfaces](./pr-06-clinic-listing-surfaces.md)
- Future PR 6 clinic/listing and pages sitemap freshness output
- [ADR 010 - Structured Logging Approach](../../../adrs/010-structured-logging-approach.md)
- [ADR 019 - PostHog Event Taxonomy and Usage Governance](../../../adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md)
- [ADR 022 - Public Localization, Routing, SEO, and Domain Strategy](../../../adrs/022-adr-public-localization-routing-seo-and-domain-strategy.md)
- [Public Discovery Strategy](../../../public-discovery-strategy.md)
- Existing sitemap and discovery files: `src/app/(frontend)/(sitemaps)/pages-sitemap.xml/route.ts`, `src/app/(frontend)/(sitemaps)/posts-sitemap.xml/route.ts`, `src/app/(frontend)/llms.txt/route.ts`, `src/app/(frontend)/.well-known/llms.txt/route.ts`, `src/features/publicDiscovery/**`, `src/features/searchIndexing/**`, `next-sitemap.config.cjs`, and `src/proxy.ts`
- Existing posts-list files: `src/app/(frontend)/posts/page.tsx`, `src/app/(frontend)/posts/page/[pageNumber]/page.tsx`, and `src/utilities/content/serverData/posts.ts`
- Existing seed files: `src/endpoints/seed/seedEndpoint.ts`, `src/endpoints/seed/tasks/seedChunkTask.ts`, `src/endpoints/seed/utils/state.ts`, `src/endpoints/seed/utils/planner.ts`, `src/endpoints/seed/utils/plan.ts`, `src/endpoints/seed/utils/import-collection.ts`, `src/endpoints/seed/utils/import-globals.ts`, and `src/endpoints/seed/utils/upsert.ts`
- Existing tests for sitemap routes, `llms.txt`, public discovery, search indexing, posts pages, seed endpoint success paths, seed imports, global seeds, and seed chunk tasks

## Objective

Align discovery and seed-driven freshness with ADR 023 by routing sitemap, posts-list, public-discovery static/no-op, and `seed-final-flush` cases through the PR 3 planner boundary.

PR 7 must make discovery/list outputs and seed/bulk completion states invalidatable through canonical PR 2 tags without changing public route content, indexing policy, seed safety policy, or the existing per-record seed suppression model.

## Non-Goals

PR 7 must not:

- add or change cache classes, tag families, freshness policies, invalidation owners, public/private boundaries, PR order, or reviewer gates
- change ADR 023, the PR 1 implementation plan, or the PR 2-PR 6 architecture contracts
- change sitemap route content, sitemap inclusion policy, canonical/noindex policy, structured data content, or source-backed timestamp rules
- make `/llms.txt` or `/.well-known/llms.txt` CMS-backed or tag-backed while they remain static public-discovery contract routes
- change robots/indexing behavior, temporary landing mode behavior, preview blocking, or crawler monitoring semantics
- enumerate paginated posts paths or create a posts pagination path invalidation matrix
- build doc-level seed reverse mapping, broad media reverse-dependency resolution, or seed-record-specific path fanout
- change production seed guards, baseline/demo separation, reset policy, queue ordering, retry behavior, or seed-run snapshot shape except for a minimal final-flush marker
- cache draft, preview, auth, cookie, request-bound, private, admin-only, or personalized data
- add legacy dual-tagging or emit legacy tags from touched PR 7 code
- add Redis, a custom cache handler, remote cache storage, PostHog events, observability UI, or dashboard storage

## Fixed Decisions

PR 7 uses these decisions without reopening them:

- Sitemaps use canonical PR 2 `surface:sitemap:*` tags and source-backed timestamps only.
- Robots and indexing policy remain route/config policy, not normal Payload document invalidation.
- `llms.txt` routes remain static in PR 7. They may be represented as public-discovery static/no-op planner cases, but they must not get CMS-backed cache wiring.
- Blog list and latest-post reads are `aggregated-public` surfaces and use canonical post collection/list/surface tags.
- `/posts` may remain a known path for list freshness. Paginated post list freshness relies on tags and bounded cache staleness, not a path matrix.
- Listing Comparison sitemap freshness remains source-backed through the PR 6 output; PR 7 may align sitemap tags but must not change sitemap content policy.
- Seed imports continue suppressing per-record public revalidation through `disableRevalidate`.
- Seed/bulk public freshness is owned by one terminal `seed-final-flush` planner event per seed run.
- Seed final flush uses job-level aggregation from completed job records or equivalent run-state metadata. It must not inspect raw seed records for doc-level fanout.
- Terminal seed flush runs on `completed`, `partial`, `failed`, or `cancelled` states only when at least one public-affecting seed job has written or completed public work before termination.
- Rejected runs and cancelled runs with no public-affecting completed work do not flush public caches.
- Retry runs are separate seed runs and get separate final-flush evaluation.
- Executor semantics remain PR 3-owned: tags first, paths second, best-effort failures, and redacted operational logging.

## Expected Implementation Shape

Policy and planner expansion:

- add or update PR 2 policy entries for sitemap surfaces, post-list surfaces, public-discovery static/no-op surfaces, and seed/bulk final-flush surfaces
- add or update PR 3 planner event types for sitemap freshness, posts-list freshness, public-discovery static/no-op, and `seed-final-flush`
- keep planner inputs normalized and serializable; do not pass raw Payload docs, raw seed records, request objects, cookies, headers, or file contents into the planner
- fail fast in tests and implementation if a public-affecting seed step or discovery surface is missing from the PR 2 policy map
- keep private/admin/operational-only seed steps as explicit public revalidation no-ops

Discovery and sitemap read-side alignment:

- replace legacy `pages-sitemap` and `posts-sitemap` tags in touched sitemap code with PR 2 canonical sitemap tag builders
- keep sitemap output, fixed public paths, excluded paths, noindex blocking, and source-backed `lastmod` behavior unchanged
- keep `llms.txt` routes static and contract-tested; do not wrap them in CMS-backed `unstable_cache` or add runtime CMS dependencies
- keep public discovery crawler logging redacted and operational; do not add PostHog events or product analytics

Posts-list read-side alignment:

- align public post list, paginated post list, and latest-post teaser reads with canonical PR 2 post collection/list/surface tags
- base cache keys only on stable public inputs such as locale, page, limit, and normalized list parameters
- keep draft, preview, auth, cookie, header, request-bound, and personalized inputs outside persistent public cache
- use tag invalidation for paginated posts freshness instead of enumerating `/posts/page/<n>` paths

Seed final-flush behavior:

- add a small seed final-flush aggregation helper under the seed runtime area or cache revalidation boundary, whichever best matches the future PR 3 public API
- derive affected collections, globals, surfaces, and operation context from seed job records and seed plan metadata, not raw seed JSON records
- count a job as public-affecting only when its collection/global maps to a public PR 2 policy entry and it has completed or written public work
- treat `created + updated > 0` as the primary write signal; global seed updates with updated counts also qualify
- execute at most one final flush per run by storing a serializable marker on the seed run record or an equivalent idempotence guard
- do not convert a completed seed run response into a hard failure because a final cache flush operation failed; log the redacted cache failure and preserve the seed terminal snapshot
- keep planner contract errors strict during implementation and tests. If a mapped public seed step cannot be planned, stop the PR instead of inventing local tags.

Logging behavior:

- log seed final-flush planning, execution, and failures through the PR 3 redacted operational log schema
- include only run id, seed type, reset flag, terminal status, affected collections/globals/surfaces, counts, and failure summaries
- never log raw docs, raw seed records, file contents, request bodies, headers, cookies, tokens, auth data, private data, CMS field payloads, medical free text, or seed fixture payloads

## Expected Tests

Add focused unit coverage for planner output, read-side tag alignment, and seed terminal flush behavior.

The tests must prove:

- planner output exists for sitemap, posts-list, public-discovery static/no-op, and `seed-final-flush` events
- planner output uses canonical PR 2 tags and paths only
- touched sitemap routes use canonical `surface:sitemap:pages` and `surface:sitemap:posts` behavior and do not emit legacy `pages-sitemap` or `posts-sitemap` tags
- sitemap `lastmod` values remain source-backed and route content policy remains unchanged
- `llms.txt` remains static, contract-tested, and not CMS-backed or cache-tag backed in PR 7
- public discovery contract, temporary landing blocking, sitemap guard behavior, and crawler monitoring redaction remain intact
- public post list, paginated post list, and latest-post reads use stable public cache keys and canonical tags
- draft, preview, auth, cookie, header, request-bound, and personalized values do not enter posts-list public cache keys
- seed per-record writes still pass `disableRevalidate` and do not trigger direct public cache invalidation
- seed final flush happens for `completed`, `partial`, `failed`, and cancelled-after-public-work terminal states
- rejected runs and cancelled runs with no public-affecting completed work do not flush public caches
- each seed run executes at most one terminal final flush
- retry runs are evaluated independently from their source runs
- seed final-flush logs and results are redacted and do not contain raw docs, seed records, request data, auth data, private data, or file contents
- executor failures remain best-effort and do not break seed terminal snapshot responses
- touched PR 7 code does not add legacy dual-tagging or emit legacy tags

Expected test files include:

- `tests/unit/utilities/cacheRevalidation/**`
- `tests/unit/app/frontend/sitemap.routes.test.ts`
- `tests/unit/app/frontend/llmsTxt.route.test.ts`
- `tests/unit/features/publicDiscovery/discoveryContract.test.ts`
- `tests/unit/features/searchIndexing/sitemapGuards.test.ts`
- `tests/unit/app/frontend/posts.page.test.tsx`
- `tests/unit/app/frontend/posts.page-number.page.test.tsx`
- `tests/unit/endpoints/seed/seedEndpoint-success.test.ts`
- `tests/unit/endpoints/seed/import-collection.test.ts`
- `tests/unit/endpoints/seed/globals-seed.test.ts`
- `tests/unit/endpoints/seed/seedChunkTask.test.ts`

Do not write tests that only duplicate constants. Prefer behavior-focused assertions that fail when a future route or seed flow bypasses the planner, reintroduces legacy tags, logs raw seed data, or broadens path revalidation beyond the fixed policy.

## Validation

The future PR 7 implementation must run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm vitest tests/unit/utilities/cacheRevalidation tests/unit/app/frontend/sitemap.routes.test.ts tests/unit/app/frontend/llmsTxt.route.test.ts tests/unit/features/publicDiscovery/discoveryContract.test.ts tests/unit/features/searchIndexing/sitemapGuards.test.ts tests/unit/app/frontend/posts.page.test.tsx tests/unit/app/frontend/posts.page-number.page.test.tsx tests/unit/endpoints/seed/seedEndpoint-success.test.ts tests/unit/endpoints/seed/import-collection.test.ts tests/unit/endpoints/seed/globals-seed.test.ts tests/unit/endpoints/seed/seedChunkTask.test.ts --project unit
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
rtk proxy /Users/razorspoint/Library/pnpm/pnpm check
rtk proxy /Users/razorspoint/Library/pnpm/pnpm build
```

Run the public discovery health check only when PR 7 changes route output, headers, or deployed discovery behavior beyond cache tags:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm discovery:health
```

Build is required for the future runtime PR because PR 7 changes public route cache behavior, seed endpoint behavior, and runtime revalidation paths.

For this planning-document PR, only run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
```

## Reviewers

Recommended reviewers for the future PR 7 implementation:

- `seo-reviewer` for sitemap, public discovery, canonical list freshness, indexing policy preservation, and `llms.txt` contract alignment
- `security-reviewer` for seed endpoint trust boundaries, public/private cache separation, redacted logging, and fail-closed discovery behavior
- `web-vitals-reviewer` for Data Cache behavior, route performance semantics, and avoiding path invalidation storms

Skip UI, accessibility, mobile UI, and Storybook reviewers unless the scope expands into rendered UI or Storybook surfaces.

Reviewers must run only after Sebastian explicitly confirms reviewer execution. Findings must be fixed and reviewers rerun before PR 8 starts, with the stack-wide maximum of three reviewer cycles unless Sebastian approves more.

## Exit Criteria

PR 7 is complete when:

- sitemap read-side tags are canonical and no touched sitemap code emits legacy sitemap tags
- sitemap output, noindex policy, and source-backed timestamp behavior remain unchanged
- `llms.txt` remains static and not CMS/cache-tag backed
- posts-list and latest-post public data use canonical tags and stable public inputs
- paginated posts freshness does not enumerate a path matrix
- seed imports continue suppressing per-record public revalidation
- terminal seed final-flush behavior runs once per qualifying seed run and uses job-level aggregation only
- rejected or cancelled runs without public-affecting completed work do not flush
- retry runs are handled as independent runs
- redacted seed final-flush logs/results contain no raw docs, seed records, request data, auth data, private data, or file contents
- production guard, baseline/demo separation, queue semantics, retry behavior, and seed-run snapshots remain behavior-compatible
- no Redis, PostHog event, observability UI, direct media reverse-dependency resolver, locale/domain cache dimension, new cache class, new tag family, or new public route family is introduced
- required tests and validation pass
- applicable reviewers report no remaining findings or documented accepted exceptions

## Stop Conditions

Stop and ask Sebastian before implementing further if:

- ADR 023, the PR 1 implementation plan, or PR 2-PR 6 outputs appear wrong or incomplete
- a new cache class, tag family, freshness policy, invalidation owner, public/private boundary, PR order, or reviewer gate seems necessary
- `llms.txt` needs CMS-backed content, Payload reads, tag-backed caching, or a changed ownership model
- discovery changes require new public route families, locale/domain discovery policy, or new sitemap inclusion rules
- seed final flush cannot be implemented from job-level aggregation and would require raw seed-record inspection or doc-level reverse mapping
- seed final flush needs broad media reverse-dependency resolution or direct media upload invalidation
- posts-list cache behavior would need draft, preview, auth, cookie, header, request-bound, private, or personalized inputs
- implementation would need Redis, a custom cache store, PostHog events, observability UI, or dashboard storage
- implementation would need legacy dual tags to keep touched PR 7 surfaces working

## Assumptions

- PR 6 has already landed canonical Clinic Detail, Listing Comparison, and Pages sitemap freshness behavior.
- PR 2 exposes canonical policy builders for discovery, posts-list, sitemap, and seed surfaces.
- PR 3 exposes planner/executor APIs that PR 7 can extend without changing the boundary.
- Job-level seed aggregation is precise enough for the first cache stack and intentionally avoids doc-level fanout.
- `llms.txt` has no CMS-backed dependency in PR 7 and stays a static public-discovery contract route.
- This work order may define runtime contracts, but must not change ADR 023 or the PR 1 cache assignment architecture.
