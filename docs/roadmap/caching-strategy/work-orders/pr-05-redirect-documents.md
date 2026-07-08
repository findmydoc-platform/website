# PR 5 Work Order: Redirect Document Reads

This work order defines the future PR 5 implementation packet for the public cache and revalidation stack. It is a planning artifact only. It does not implement PR 5 and does not change runtime behavior.

## Summary

PR 5 resolves redirect target document drift. The current `getCachedDocument` helper is slug-based, but the visible redirect caller passes a Payload relationship id into it. The helper also creates `${collection}_${slug}` cache tags that are outside the ADR-023 canonical tag model and are not a stable owned cache surface.

- Branch: `feature/cache-revalidation/05-redirect-documents`
- PR title: `fix(redirects): align cache stack 5/8 redirect document reads`
- Base branch: `feature/cache-revalidation/04-core-hooks`
- Dependency: PR 4 is implemented, validated, reviewer-clean, and based on the accepted PR 1 plan.
- Scope type: redirect target document read alignment.

PR 5 removes `getCachedDocument` instead of replacing it with another generic document cache helper. Reference redirect targets are resolved live by id, only when a matching reference redirect is actually used.

## Source Inputs

- [ADR 023 - Public Website Cache and Revalidation Strategy](../../../adrs/023-adr-public-website-cache-and-revalidation-strategy.md)
- [Public Cache And Revalidation Implementation Plan](../cache-revalidation-implementation-plan.md)
- [PR 2 Work Order: Cache Policy Map](./pr-02-policy-map.md)
- Future PR 2 `src/utilities/cachePolicy/**` implementation output
- [PR 3 Work Order: Revalidation Planner And Executor](./pr-03-planner-executor.md)
- Future PR 3 `src/utilities/cacheRevalidation/**` implementation output
- [PR 4 Work Order: Core Hooks](./pr-04-core-hooks.md)
- Future PR 4 core-hook and read-side tag implementation output
- [ADR 010 - Structured Logging Approach](../../../adrs/010-structured-logging-approach.md)
- [ADR 019 - PostHog Event Taxonomy and Usage Governance](../../../adrs/019-adr-posthog-event-taxonomy-and-usage-governance.md)
- [ADR 022 - Public Localization, Routing, SEO, and Domain Strategy](../../../adrs/022-adr-public-localization-routing-seo-and-domain-strategy.md)
- [Public Discovery Strategy](../../../public-discovery-strategy.md)
- Current redirect files: `src/app/(frontend)/_components/PayloadRedirects/index.tsx`, `src/utilities/getDocument.ts`, and `src/utilities/getRedirects.ts`
- Current tests and route usage: `tests/unit/utilities/payloadDataFetchers.test.ts`, `src/app/(frontend)/(pages)/[...slug]/page.tsx`, and `src/app/(frontend)/posts/[slug]/page.tsx`

## Objective

Remove the misleading generic cached document helper and make reference redirect target resolution explicit, public-safe, and narrow.

PR 5 must preserve custom URL redirects and existing `PayloadRedirects` route behavior while removing the slug-versus-id mismatch. Redirect rules remain cached through the PR 4 canonical redirect cache tag model. Target document reads are live by id because they happen only for matched reference redirects and must not imply a separate unowned cache policy.

## Non-Goals

PR 5 must not:

- add a new generic cached document helper
- replace `getCachedDocument` with a new broad cache abstraction
- introduce new cache classes, tag families, freshness policies, invalidation owners, public/private boundaries, PR order, or reviewer gates
- change ADR 023, the PR 1 implementation plan, the PR 2 policy-map contract, the PR 3 planner/executor contract, or the PR 4 core-hook contract
- change redirect authoring semantics or plugin configuration beyond the read-side behavior required here
- change public route matching behavior for Pages or Posts outside `PayloadRedirects`
- add locale/domain-specific redirect behavior
- change sitemap, public discovery, `llms.txt`, seed/bulk, clinic/listing, media dependency, or observability behavior
- add legacy dual-tagging or keep `${collection}_${slug}` cache tags in touched code
- add Redis, a custom cache handler, remote cache storage, locks, dedupe, or runtime cache persistence
- add PostHog events or dashboard/admin visibility

## Fixed Decisions

PR 5 uses these decisions without reopening them:

- `getCachedDocument` is removed.
- Reference redirect targets are resolved live by Payload id.
- Only `pages` and `posts` reference targets are supported.
- Redirect rules themselves stay cached through `getCachedRedirects`, but they are loaded at `depth: 0`.
- Embedded reference object slugs are not authoritative redirect targets. If a reference value is an object, the resolver uses its stable id and re-resolves the public target.
- Reference target reads must be public-safe: `overrideAccess: false`, `draft: false`, `depth: 0`, and a narrow field selection.
- Missing, inaccessible, draft/unpublished, deleted, invalid, or slug-less targets fail closed.
- Fail-closed means no redirect to an empty, guessed, fallback, or unsafe URL. Existing `disableNotFound` behavior decides whether the component returns `null` or calls `notFound()`.
- Custom URL redirects stay unchanged.
- The additional Payload/database read happens only for matched reference redirects, not for ordinary requests without a matching redirect rule and not for custom URL redirects.
- Redacted warnings are allowed only if they follow existing server logging patterns and do not log raw documents, request data, headers, cookies, tokens, sessions, or unrelated CMS fields.

## Expected Implementation Shape

The future implementation should keep redirect target resolution local to the redirect component boundary.

Expected runtime changes:

- Delete `src/utilities/getDocument.ts` when no non-PR5 caller remains.
- Remove `getCachedDocument` imports and tests.
- Add a small route-local resolver, for example `src/app/(frontend)/_components/PayloadRedirects/resolveRedirectTargetPath.ts`.
- Use the resolver from `src/app/(frontend)/_components/PayloadRedirects/index.tsx` only after a matching redirect rule is found and only for reference redirects.
- Keep direct custom URL redirects as the fast path.
- Update `src/utilities/getRedirects.ts` so redirect rules default to `depth: 0` and the cached read uses the PR 4 canonical redirect cache tag or tags.

Resolver behavior:

- Accept only normalized redirect reference data needed to resolve the target: relation collection and value id.
- Support only `pages` and `posts`.
- Convert string ids to the id type accepted by Payload only when the conversion is safe and explicit.
- Resolve Pages by id with public-safe Payload reads and select only fields needed to validate and build the public path.
- Resolve Posts by id with public-safe Payload reads and select only fields needed to validate and build the public path.
- Return `/` for a published Page with slug `home`.
- Return `/<slug>` for other published Pages.
- Return `/posts/<slug>` for published Posts.
- Normalize and validate any returned internal path with the existing routing sanitizer/path utility, such as `src/utilities/routing/sanitizeInternalRedirectPath.ts` or its direct successor, before `PayloadRedirects` can pass it to `redirect()`.
- Do not let a sanitizer fallback convert an invalid candidate into `/`; `/` is allowed only when the target was first resolved as a published Page with slug `home`.
- If the existing sanitizer only exposes fallback-returning behavior, PR 5 must use or extend a shared utility so the resolver can distinguish a valid sanitized path from a fallback before redirecting.
- Stop instead of adding an ad hoc redirect-path sanitizer if the existing utility cannot safely represent the required Page/Post path behavior.
- Return `null` for missing, inaccessible, unpublished, deleted, invalid, unsupported, or slug-less targets.
- Never infer a target path from the original source URL, redirect id, collection name alone, or a stale embedded reference slug.

`PayloadRedirects` behavior:

- Fetch cached redirect rules.
- Find the matching rule by `from`.
- Redirect immediately for custom URL targets.
- For reference targets, call the resolver.
- Redirect only when the resolver returns a non-empty safe internal path.
- Preserve existing `disableNotFound`: return `null` when disabled and no usable redirect target exists; otherwise call `notFound()`.

## Expected Tests

Add focused tests for redirect target resolution and update existing utility tests.

The tests must prove:

- `getCachedDocument` tests and imports are removed.
- no touched code emits or expects `${collection}_${slug}` tags.
- `getRedirects` defaults to `depth: 0`.
- `getCachedRedirects` keeps cached redirect rules and uses PR 4 canonical redirect tags.
- custom URL redirects still call `redirect()` with the configured URL.
- page reference redirects resolve by id and redirect to `/<slug>`.
- a Page target with slug `home` redirects to `/`.
- post reference redirects resolve by id and redirect to `/posts/<slug>`.
- resolved reference paths pass through the existing redirect/path sanitizer and unsafe path candidates fail closed instead of reaching `redirect()`.
- unsafe reference path candidates are not converted to `/` by sanitizer fallback behavior; `/` is asserted only for a verified published `home` Page target.
- embedded reference object slugs are not used as authoritative targets; the id is re-resolved.
- missing targets fail closed.
- draft, unpublished, deleted, inaccessible, unsupported, invalid, or slug-less targets fail closed.
- fail-closed with `disableNotFound` returns `null`.
- fail-closed without `disableNotFound` calls `notFound()`.
- reference target resolution uses public-safe Payload reads with `overrideAccess: false`, `draft: false`, `depth: 0`, and narrow field selection.
- custom URL redirects and requests without a matching redirect rule do not perform target document reads.

Expected test files include:

- `tests/unit/app/frontend/payloadRedirects.test.tsx`
- `tests/unit/utilities/payloadDataFetchers.test.ts`
- `tests/unit/hooks/revalidateRedirects.test.ts`

Do not write tests that only duplicate constants. Prefer behavior-focused assertions that fail when redirect target resolution falls back to stale embedded slugs, reintroduces unowned document caching, or redirects to an unsafe empty path.

## Validation

The future PR 5 implementation must run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm vitest tests/unit/app/frontend/payloadRedirects.test.tsx tests/unit/utilities/payloadDataFetchers.test.ts tests/unit/hooks/revalidateRedirects.test.ts --project unit
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
rtk proxy /Users/razorspoint/Library/pnpm/pnpm check
rtk proxy /Users/razorspoint/Library/pnpm/pnpm build
```

Build is required for the future runtime PR because PR 5 changes Next.js route component behavior and Payload-backed runtime utilities.

For this planning-document PR, only run:

```bash
rtk proxy /Users/razorspoint/Library/pnpm/pnpm format
```

## Reviewers

Recommended reviewers for the future PR 5 implementation:

- `security-reviewer` for public-safe target reads, fail-closed behavior, raw-data exclusion, and redirect safety
- `seo-reviewer` for canonical redirect targets, no empty/fallback redirects, and Page/Post path behavior

Add `web-vitals-reviewer` only if implementation broadens beyond reference redirect target resolution or changes route/cache behavior on ordinary non-redirect page views.

Skip UI, accessibility, mobile UI, and Storybook reviewers unless the scope expands into those surfaces.

Reviewers must run only after Sebastian explicitly confirms reviewer execution. Findings must be fixed and reviewers rerun before PR 6 starts, with the stack-wide maximum of three reviewer cycles unless Sebastian approves more.

## Exit Criteria

PR 5 is complete when:

- `getCachedDocument` and its tests/imports are removed
- no touched code emits or expects `${collection}_${slug}` cache tags
- `PayloadRedirects` resolves reference targets by id through a narrow public-safe resolver
- only Pages and Posts reference targets are supported
- redirect rules are cached at `depth: 0` through the canonical PR 4 redirect tag model
- custom URL redirects keep their existing behavior
- missing, inaccessible, draft/unpublished, deleted, invalid, unsupported, or slug-less targets fail closed
- `disableNotFound` and `notFound()` behavior remains compatible with current Page/Post route usage
- no generic document cache helper, Redis, PostHog event, locale/domain redirect policy, or discovery expansion is introduced
- required tests and validation pass
- applicable reviewers report no remaining findings or documented accepted exceptions

## Stop Conditions

Stop and ask Sebastian before implementing further if:

- ADR 023, the PR 1 implementation plan, the PR 2 policy map, the PR 3 planner/executor contract, or the PR 4 core-hook output appears wrong or incomplete
- a generic cached document helper appears necessary
- reference target reads cannot be implemented with public-safe Payload access
- redirect correctness requires using embedded reference object slugs as authoritative targets
- redirect behavior needs a new cache class, tag family, freshness policy, invalidation owner, public/private boundary, PR order, or reviewer gate
- redirect behavior needs locale/domain routing policy changes
- implementation requires changing sitemap, discovery, seed/bulk, media, clinic/listing, or observability behavior
- runtime behavior requires legacy dual-tagging or `${collection}_${slug}` tags
- Redis, custom cache handlers, remote cache storage, locks, dedupe, or runtime cache persistence appears necessary
- a PostHog business event or dashboard UI becomes necessary

Do not patch ADR 023, the PR 1 implementation plan, PR 2, PR 3, or PR 4 inside PR 5. Those are architecture or predecessor-contract changes and must be handled separately.

## Assumptions

- PR 1 is merged into `main` and remains the operative stack/order/governance source.
- PR 2 creates the pure `src/utilities/cachePolicy/**` contract before PR 5 starts.
- PR 3 creates the `src/utilities/cacheRevalidation/**` planner/executor boundary before PR 5 starts.
- PR 4 aligns Redirect rule invalidation and read-side tags through the planner and canonical PR 2 tags before PR 5 starts.
- `pages` and `posts` access rules with `overrideAccess: false` expose only public/published content for anonymous redirect resolution.
- PR 5 intentionally favors architecture clarity over caching redirect target document reads.
- PR 6 and PR 7 expand planner coverage for clinic/listing, discovery, seed/bulk, and related public surfaces.
- PR 8 consumes redacted operational outputs for privileged visibility if that scope is still needed.
- The future full-stack execution goal may start PR 5 only after PR 4 is complete and reviewer-clean.
