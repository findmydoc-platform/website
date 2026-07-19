# Temporary Landing Public Blog

> Reviewed design and implementation record. This roadmap file preserves scope, decisions, and verification expectations; repository code and its tests remain authoritative for runtime behavior.

## Decision Evidence

- Visual truth: the versioned Storybook scenarios in `src/stories/templates/HoldingPageConcept.stories.tsx`, `src/stories/templates/BlogListing.stories.tsx`, and `src/stories/organisms/BlogCardCollection.stories.tsx`.
- Selected direction: insert a compact three-card blog section after the temporary landing signals and before the footer, using the existing `BlogCard.Simple` card from the public blog listing.
- Decision status: implemented and locally verified on `feature/public-blog-holding-page`.
- Current implementation evidence:
  - `src/app/(frontend)/page.tsx` returns the temporary landing page before loading the normal homepage blog data.
  - `src/features/temporaryLandingMode/index.ts` does not currently classify `/posts` as publicly reachable in temporary landing mode.
  - `src/components/templates/HoldingPageConcept/index.tsx` renders the immersive holding sequence as hero, founder/contact content, signals, and footer.
  - `src/app/(frontend)/posts/page.tsx` composes the public listing from `BlogHero`, `BlogCard.Overlay`, and `BlogCard.Simple`.
  - `src/utilities/content/serverData/posts.ts` already provides cached public post-list and latest-post reads.
- Implementation note: existing production posts remain untouched and are removed or unpublished manually by an authorized Payload editor.

## Product Decision

The temporary landing page reuses the public blog listing's simple cards instead of introducing a new card style or embedding the complete homepage `BlogCardCollection` unchanged.

The `BlogCard.Simple` direction is preferred because it:

- preserves the holding page's restrained light visual rhythm
- avoids a second dominant hero-like surface below the immersive hero
- removes author-avatar and arrow density that is not needed for a three-post teaser
- already has a whole-card link, an accessible label, and an explicit keyboard focus treatment
- can reuse the public listing's one-, two-, and three-column responsive behavior

The complete `BlogCardCollection` remains a valid implementation reference, but its full-width section ownership, container, vertical spacing, author treatment, and CTA make direct nesting in the holding template unnecessarily heavy.

## Scope

### Must

- Keep the temporary landing root page publicly reachable as it is today.
- Make `/posts`, `/posts/page/:pageNumber`, and `/posts/:slug` reachable without platform login while temporary landing mode is active.
- Keep unrelated protected product routes unavailable to anonymous visitors.
- Render up to three latest published posts after the holding-page signal cards and before the footer.
- Reuse `BlogCard.Simple`, `Heading`, and `UiLink` rather than duplicating their markup or visual rules; inherit the holding template's existing outer `Container` instead of nesting another one.
- Hide the complete teaser section when no published posts are available.
- Preserve draft, preview, admin, auth, and personalized data as live/private data.
- Keep deletion or unpublishing of existing production posts as a manual Payload operation.

### Should

- Keep the heading, introduction, and CTA labels in the temporary landing locale copy.
- Carry the supported content locale into the post cards, listing CTA, and detail links.
- Use English post content as the explicit fallback for the Turkish holding locale until Turkish CMS content localization exists.
- Keep the current temporary-landing `X-Robots-Tag` behavior unless a separate SEO decision explicitly opens blog indexation and discovery surfaces.

### Must Not

- Add a new blog card visual language.
- Copy card JSX from the listing or homepage into the holding template.
- Use the large `BlogCard.Overlay` featured treatment on the holding page.
- Add a new Payload collection, field, migration, cache class, cache tag family, or invalidation owner.
- Delete or unpublish production posts from application code, a migration, a seed, or deployment automation.
- Expose other routes merely because the blog becomes public.

### Out of Scope

- Writing or publishing replacement blog content.
- Automated production-content deletion.
- Turkish CMS content localization.
- Changing post schemas, post-detail design, or the full blog-listing design.
- Opening `robots.txt`, sitemap output, or blog routes for search indexing during temporary landing mode.
- Reworking the temporary landing hero, contact form, signal cards, or footer.

## Visible UI Contract

Anything not listed here is out of implementation scope.

| UI element | User value | Data source | Component ownership | Allowed behavior |
| --- | --- | --- | --- | --- |
| Blog section heading | Explains that current editorial content is already available | Temporary landing locale copy | `Heading` in a small temporary-landing blog section | Static localized text |
| Blog section introduction | Sets expectations for the three articles | Temporary landing locale copy | Temporary-landing blog section | Static localized text; may be omitted if copy remains concise without it |
| Three article cards | Gives anonymous visitors direct access to useful public content | Latest published `posts` documents | Existing `BlogCard.Simple` | Whole card navigates to the localized post detail path |
| Category badge | Helps visitors scan article topics | Existing normalized post category | Existing `BlogCard.Simple` | Display only when present |
| Article metadata | Provides source and publication context | Existing normalized author and publication date | Existing `BlogCard.Simple` | Use current truncation and fallback behavior |
| All-articles CTA | Opens the complete public blog listing | Existing post path builder plus temporary landing locale mapping | Existing `UiLink` | Navigate to the localized `/posts` index |
| Empty state | Avoids an empty section when no content is publishable | Published-post query result | Route composition | Render no blog section |

## Data and Permissions

| Collection or source | Fields or capability | Relationship | Permission | Provenance or freshness | Status |
| --- | --- | --- | --- | --- | --- |
| `posts` | Title, slug, excerpt, category, author, publication date, hero image | Latest three published records | Public read only; drafts excluded | Payload source, existing cached server-data loader | Available |
| Temporary landing locale | `en`, `de`, `tr` | Selects section copy and supported post content locale | Public query parameter | Code-owned locale map | Available |
| Blog content locale | `en`, `de` | Controls normalized post copy and generated paths | Public query parameter with English fallback | Existing content-localization utilities | Available |
| Turkish blog content | Localized post fields | Would map holding locale `tr` to post content | Public | No Turkish CMS content locale exists | Data Gap |
| Production post removal | Delete or unpublish records | Removes cards, listing entries, and detail routes | Authorized Payload editor only | Manual production operation with existing revalidation hooks | User-owned operation |

## Component Plan

| Feature | Reuse, change, or new | Candidate component or module | Notes |
| --- | --- | --- | --- |
| Article cards | Reuse | `src/components/organisms/Blog/BlogCard/Simple.tsx` | Use unchanged unless composed-route QA proves a real defect |
| Blog grid | Reuse pattern | `src/app/(frontend)/posts/page.tsx` | Reuse its responsive grid behavior for three cards |
| Holding insertion point | Small change | `src/components/templates/HoldingPageConcept/index.tsx` | Add one optional post-signals composition slot before `FooterBlock`; do not fetch data here |
| Temporary blog section | New composition only | `src/components/templates/TemporaryLandingPage/` or a colocated child module | Own heading, grid, CTA, and empty rendering; remain Payload-free |
| Post loading | Extend existing read | `src/utilities/content/serverData/posts.ts` | Make latest-post caching content-locale-aware without changing tags or policy |
| Route composition | Change | `src/app/(frontend)/page.tsx` | Resolve locale, load latest public posts, normalize them, and pass presentation data down |
| Public route boundary | Change | `src/features/temporaryLandingMode/index.ts`, `src/proxy.ts` | Allow only `/posts`, `/posts/:singleSlug`, and `/posts/page/:positiveInteger`; preserve all other restrictions |
| Localized copy | Change | `src/features/temporaryLandingMode/content.ts` | Add section heading, introduction if retained, and CTA label for `en`, `de`, and `tr` |

## Cache Impact

### Decision

`public-cached` applies because the holding page adds another public rendering of cached published post data. The existing `aggregated-public` policy and invalidation vocabulary already cover the required read and write paths.

### Dependency Map

- Public reads: latest three published posts for `/`; paginated published posts for `/posts`; published post detail for `/posts/:slug`.
- Rendered surfaces: temporary landing `home` teaser, posts listing, posts pagination, and post detail.
- Write events: post publish, update, slug change, unpublish, and delete.
- Existing discovery dependencies: posts sitemap and posts-list surfaces remain governed by the current policy even though temporary landing mode keeps search indexation out of this scope.
- Excluded inputs: draft, preview, admin, auth, private, personalized, cookie-bound, and request-bound data.

### Read/Write Symmetry

- Cache class: `aggregated-public` for list and landing aggregations; existing `critical-public` behavior remains on detail routes.
- Policy entry: existing `route:posts:list`.
- Latest-post cache key: use the shared post-list key builder with limit, content-locale, and fallback-locale dimensions.
- Read tags: existing `collection:posts`, `surface:posts-list`, `surface:home`, `surface:partners-clinics`, and `surface:sitemap:posts` tag builders.
- Normalized event: existing post collection change and delete events.
- Invalidation owner: existing Posts collection hooks through the central revalidation adapter, planner, and executor.
- Planner outcome: invalidate post entity/slug state, post collection/list/home surfaces, post sitemap, `/posts`, and bounded old/new post detail paths.
- New cache semantics: none.

### Cache Tests

- Prove locale dimensions produce distinct latest-post cache keys.
- Prove latest-post reads retain the existing canonical tag set.
- Preserve planner coverage for publish, slug change, unpublish, and delete.
- Prove the holding teaser refreshes through the existing `surface:home` invalidation path rather than a new tag.

### Stop Conditions

Stop for an ADR or explicit work order if implementation requires a new cache class, tag family, owner, freshness expectation, route family, Redis or remote cache, custom cache handler, Cache Components, or changed invalidation semantics.

## Implementation Sequence

1. Add localized blog-section copy and an explicit holding-to-content-locale mapping.
2. Extend the latest-post cached read with locale-aware cache-key dimensions while retaining its existing tags and invalidation owner.
3. Add the small presentation-only temporary blog section using `BlogCard.Simple`.
4. Add the optional post-signals composition slot to the immersive holding layout and inject the blog section from `TemporaryLandingPage`.
5. Open the exact blog index, single-segment detail, and positive-integer pagination route shapes to anonymous temporary-landing visitors.
6. Add focused unit, proxy, route, Storybook, and cache-contract coverage.
7. Complete mobile-first route QA and capture ignored Playwright screenshots.
8. After replacement content is published and verified, let an authorized editor manually delete or unpublish the existing production posts.
9. Verify the teaser, listing, detail routes, and removal of stale links after the manual content operation.

## Acceptance Criteria

- Product behavior:
  - Anonymous visitors in temporary landing mode can open `/`, `/posts`, paginated blog listing paths, and published post detail paths.
  - Unrelated product routes remain unavailable.
  - The landing page shows at most three latest published posts after the signals and before the footer.
  - Every card and the all-articles CTA navigate to a public blog route.
  - No published posts results in no blog section.
- Responsive behavior:
  - Verify `320`, `375`, `640`, `768`, `1024`, and `1280` widths.
  - Preserve one-column mobile order, expand deliberately to two and then three columns, and prevent horizontal overflow or clipped labels.
  - Verify realistic long titles, long categories, missing excerpts, missing dates, and missing authors.
- Accessibility:
  - Preserve whole-card accessible names and visible keyboard focus.
  - Keep heading order coherent after the signals.
  - Do not rely on hover for navigation or article discovery.
  - Verify keyboard traversal from the signal section through all cards, the CTA, and the footer.
- Data and permissions:
  - Query only published public posts.
  - Force draft access off when the temporary-landing request header is present, even if an anonymous request carries a stale draft cookie.
  - Keep drafts and preview reads outside the public cache.
  - Do not automate production post deletion.
- Verification evidence:
  - Storybook covers default, empty, long-content, and responsive teaser states.
  - Unit tests cover locale mapping, route-prefix boundaries, empty rendering, and cache-key/tag contracts.
  - Proxy tests cover anonymous access with temporary landing mode alone and with preview guard also active.
  - Composed-route Playwright checks cover `/`, `/posts`, and one post detail at the required viewport matrix.
  - Required repository validation is `pnpm format`, `pnpm check`, and `pnpm build` with the documented Payload secret and database prerequisites.

## Production Content Removal

Existing production posts are removed manually in Payload after replacement content and public routing are verified.

Recommended operator order:

1. Publish replacement posts.
2. Verify the three teaser cards, listing, and detail routes.
3. Unpublish or delete the existing posts in Payload.
4. Confirm the existing post hooks revalidate the teaser, listing, sitemap tags, and old detail paths.
5. Confirm no deleted post remains linked or publicly reachable.

If all posts are removed before replacements exist, the teaser intentionally disappears and the listing remains available without article cards.

## Assumptions and Data Gaps

### Assumptions

- “Publicly visible” means reachable without login; it does not automatically mean indexable by search engines during temporary landing mode.
- The selected visual direction is the existing simple blog-listing card, not a new mockup and not the complete homepage blog section.
- English is the temporary fallback for Turkish blog content.
- The existing `X-Robots-Tag` behavior remains unchanged until SEO indexation is separately approved.

### Data Gaps

- Turkish localized blog fields are not available.
- Replacement production post content and its publication schedule are not part of this plan.
- The future authoritative GitHub issue does not yet exist.

## Revalidated Existing-Code Findings

The implementation review confirmed that the following gaps predated this feature plan. They are fixed in the same change because the new public surface would otherwise inherit or amplify them:

- The temporary-landing public-route helper had no exact blog route contract; a generic prefix would have widened access to non-blog paths.
- Post detail draft access trusted `draftMode()` without a temporary-landing anonymous boundary.
- The existing Storybook and live blog grid evidence used conflicting responsive breakpoints.
- The existing central `blogCard` image `sizes` policy did not match the live `sm` and `xl` grid breakpoints.
- The existing latest-post loader selected full rich-text content even though the teaser cards do not render read time.
- The public posts index had no visible localized empty state after all posts are removed.

These are repository-level corrections to existing components and loaders, not deficiencies invented by the implementation plan.

## Implementation Verification

- `pnpm format`: passed.
- `pnpm check`: passed.
- Unit test suite: 287 files and 2,181 tests passed.
- Story governance: 109 story files and 6 MDX documents passed validation.
- Storybook production build: passed.
- Playwright Storybook QA: `320`, `375`, `640`, `768`, `1024`, and `1280` widths showed no horizontal overflow; visual screenshots cover the holding insertion at `375` and `1280`.
- Security, SEO, accessibility, Web Vitals, cache architecture, and Storybook reviews: no findings at `5/10` or higher.
- Next.js production build: compilation and TypeScript passed; page-data collection could not finish because Docker Desktop could not start the required local Postgres service.
- Route-level runtime QA remains unconfirmed for the same local database limitation; Storybook evidence is supporting rather than a substitute for that check.

## Review Handoff

- Expected implementation surfaces:
  - temporary landing route composition and locale copy
  - public route access boundary in the proxy
  - existing cached post loader and cache-key contract
  - a small image-heavy responsive teaser composition
  - Storybook, unit, proxy, and route-level UI coverage
- Required reviewers and rationale:
  - Product Design audit: verify that the selected existing card treatment fits the current holding-page hierarchy without introducing a competing visual language.
  - Mobile UI reviewer: verify hierarchy, card stacking, image sizing, overflow, and CTA placement across the required matrix.
  - Accessibility reviewer: verify heading structure, card naming, keyboard focus, and link traversal.
  - Security reviewer: verify that the new public prefix does not widen access beyond published blog routes.
  - SEO reviewer: verify the deliberate boundary between public reachability and continued temporary-mode noindex behavior.
  - Web Vitals reviewer: verify image sizing, loading behavior, and landing-page impact.
  - Cache architecture reviewer: verify public read/write symmetry and the absence of new cache semantics.
