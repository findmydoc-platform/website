# PR 2 Work Order: Cache Policy Map

This work order defines the future PR 2 implementation packet for the public cache and revalidation stack. It is a planning artifact only. It does not implement PR 2 and does not change runtime behavior.

## Summary

PR 2 introduces the central, pure cache policy code contract that later PRs use for cache classes, tag families, public path builders, known public surfaces, and operation vocabulary.

- Branch: `feature/cache-revalidation/02-policy-map`
- PR title: `refactor: add cache stack 2/8 policy map`
- Base branch: `main`
- Dependency: PR 1 and ADR 023 are already merged into `main`.
- Scope type: contract-only runtime code preparation.

The implementation must not ask the executor to decide cache classes, freshness expectations, invalidation owners, tag families, public/private boundaries, PR order, or reviewer gates.

## Source Inputs

- [ADR 023 - Public Website Cache and Revalidation Strategy](../../../adrs/023-adr-public-website-cache-and-revalidation-strategy.md)
- [Public Cache And Revalidation Implementation Plan](../cache-revalidation-implementation-plan.md)
- [ADR 010 - Structured Logging Approach](../../../adrs/010-structured-logging-approach.md)
- [ADR 019 - PostHog Event Taxonomy and Usage Governance](../../../adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md)
- [ADR 022 - Public Localization, Routing, SEO, and Domain Strategy](../../../adrs/022-adr-public-localization-routing-seo-and-domain-strategy.md)
- [Public Discovery Strategy](../../../public-discovery-strategy.md)

## Objective

Add a central cache policy module that turns the accepted cache architecture into typed, pure, testable code without changing runtime cache behavior.

The policy map must provide a stable base for PR 3 planner/executor work and PR 4-8 runtime wiring. Future implementers must be able to consume the module without inventing tag names, path shapes, cache classes, or surface IDs locally.

## Non-Goals

PR 2 must not:

- route collection hooks, global hooks, redirect hooks, routes, sitemap routes, seed flows, or media hooks through a planner
- call `revalidateTag` or `revalidatePath`
- change `unstable_cache` usage
- alter route `dynamic`, `revalidate`, `force-static`, or `force-dynamic` behavior
- replace existing runtime tag strings in hooks or helpers
- add legacy dual-tagging for `global_header`, `global_footer`, `global_landingPages`, `global_cookieConsent`, `pages-sitemap`, `posts-sitemap`, `redirects`, or `${collection}_${slug}`
- repair, remove, or rewire `getCachedDocument`
- add Redis, a custom cache handler, remote cache storage, locks, dedupe, or runtime cache persistence
- change ADR 023 or the PR 1 implementation plan

## Fixed Decisions

PR 2 uses these decisions without reopening them:

- Module location: `src/utilities/cachePolicy/**`
- API shape: machine-readable catalog plus pure builders.
- Catalog scope: full PR 1 cache assignment matrix, expressed as code contracts.
- Tag policy: ADR-023 canonical tags only.
- Operation policy: vocabulary only; no planner logic.
- Input behavior: fail fast for invalid inputs.
- Legacy behavior: existing runtime legacy tags remain unchanged until later PRs migrate their owners.

The cache classes are exactly:

- `critical-public`
- `shared-public`
- `aggregated-public`
- `private-live`
- `operational-scaling`

The canonical tag families are exactly:

- `entity:<collection>:<id>`
- `slug:<collection>:<slug>`
- `collection:<collection>`
- `global:<slug>`
- `surface:<name>`
- `surface:sitemap:<name>`
- `surface:discovery:<name>`

The operation vocabulary must include only names needed by later planner work, such as:

- `publish`
- `update`
- `unpublish`
- `delete`
- `slug-change`
- `global-update`
- `related-update`
- `seed-final-flush`
- `preview-read`

The vocabulary must not compute affected tags or paths in PR 2.

## Expected Implementation Shape

The implementation should create a small pure module under `src/utilities/cachePolicy/**`.

The module should expose:

- types for cache classes, boundaries, known surfaces, tag families, and operation names
- a `CACHE_POLICY_CATALOG` or equivalent machine-readable catalog
- pure tag builders for entity, slug, collection, global, surface, sitemap, and discovery tags
- pure path builders for known public path families, including page detail, post detail, clinic detail, posts index, posts pagination, fixed landing paths, sitemap paths, and discovery paths
- surface IDs for the public route, global, collection, discovery, seed, and operational surfaces from the PR 1 matrix

The catalog should be machine-readable, not prose-heavy. It should include IDs, cache class, public/private or operational boundary, owner category, relevant tag families, and path relationship where applicable. Freshness explanations stay in ADR 023, the PR 1 implementation plan, and the PR-specific work orders.

Builder behavior:

- root-relative paths must start with `/` and must not start with `//`
- empty or whitespace-only IDs, slugs, collections, globals, and surface names must throw
- unknown surface IDs must throw
- Payload slugs must be preserved as provided after trimming; builders must not slugify, lowercase, or otherwise invent canonical content slugs
- future locale/domain dimensions must not be hard-coded with fake values

PR 2 may add local helper functions inside the policy module when they keep validation and normalization reusable. Those helpers must remain pure and must not import Payload, Next cache APIs, route modules, request objects, environment readers, loggers, or database clients.

## Expected Tests

Add focused unit coverage for the new policy module.

The tests must prove:

- cache classes match ADR 023 and PR 1
- canonical tag builders produce `entity:*`, `slug:*`, `collection:*`, `global:*`, `surface:*`, `surface:sitemap:*`, and `surface:discovery:*` strings
- path builders produce the known public paths, including `home` page slug to `/`, post detail paths, clinic detail paths, posts index, posts pagination, landing routes, sitemap paths, and discovery paths
- invalid inputs fail fast
- the operation vocabulary exists but does not compute planner output
- the catalog includes the central PR 1 public routes, globals, collections, discovery surfaces, seed/bulk flows, and observability boundary
- the policy module does not export or generate legacy tag names such as `global_header`, `pages-sitemap`, `posts-sitemap`, `redirects`, or `${collection}_${slug}`

Tests should live near existing utility tests, for example `tests/unit/utilities/cachePolicy.test.ts`.

Do not write tests that only duplicate constants without proving a public behavior contract. Prefer table-driven assertions where they make the policy surface easier to scan.

## Validation

The future PR 2 implementation must run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm vitest tests/unit/utilities/cachePolicy.test.ts --project unit
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
rtk proxy /Users/razorspoint/Library/pnpm/pnpm check
```

Run `pnpm build` only if PR 2 expands into Next.js, Payload config, routing, or output-affecting changes. Under this work order, it should not.

For this planning-document PR, only run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
```

## Reviewers

Recommended reviewers for the future PR 2 implementation:

- `security-reviewer` for private-live separation, trust boundaries, and fail-fast behavior
- `seo-reviewer` for public discovery, sitemap, canonical surface, and tag naming alignment

Add `web-vitals-reviewer` only if PR 2 unexpectedly touches route caching semantics. Skip UI, accessibility, mobile UI, and Storybook reviewers unless the scope expands into those surfaces.

Reviewers must run only after Sebastian explicitly confirms reviewer execution. Findings must be fixed and reviewers rerun before PR 3 starts, with the stack-wide maximum of three reviewer cycles unless Sebastian approves more.

## Exit Criteria

PR 2 is complete when:

- `src/utilities/cachePolicy/**` exists and contains only pure policy code
- all cache classes and tag families from ADR 023 are represented
- the central PR 1 surface assignments are represented in a machine-readable catalog
- canonical tag and path builders are tested
- invalid input behavior is tested
- operation vocabulary is present without planner logic
- no runtime hook, route, sitemap, seed, redirect, media, or cache-helper behavior changes
- validation passes
- applicable reviewers report no remaining findings or documented accepted exceptions

## Stop Conditions

Stop and ask Sebastian before implementing further if:

- ADR 023 or the PR 1 implementation plan appears wrong or incomplete
- a new cache class, tag family, freshness policy, invalidation owner, public/private boundary, PR order, or reviewer gate seems necessary
- runtime wiring is required to make the policy module meaningful
- legacy dual-tagging seems required
- `getCachedDocument` must be changed to keep PR 2 coherent
- a surface cannot be mapped from ADR 023 or the PR 1 implementation plan
- a direct Redis, custom cache handler, or remote cache store decision appears necessary

Do not patch ADR 023 or the PR 1 implementation plan inside PR 2. Those are architecture changes and must be handled separately.

## Assumptions

- PR 1 is merged into `main` and remains the operative stack/order/governance source.
- ADR 023 remains the architecture contract.
- PR 2 is the first implementation PR but is intentionally contract-only.
- PR 3 will add planner/executor behavior.
- PR 4-8 will consume this policy map for runtime wiring.
- The future full-stack execution goal may start only after work orders for PR 2 through PR 8 are all decision-complete.
