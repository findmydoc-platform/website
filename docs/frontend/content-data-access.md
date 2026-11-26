# Content Data Access

This document describes the shared server-side query helpers used for repeated Payload reads in the frontend.

## Where it lives

- `src/utilities/content/serverData`

## When to use it

Use these helpers whenever multiple routes or blocks need the same Payload query shape.

## Available helpers

### Posts

- `findLatestPosts(payload, limit)` for homepage and partner landing cards
- `findPublishedPostsPage(payload, options)` for paginated post archives
- `getCachedPublicPostRoute(slug, locale)` for published post detail reads
- `findPostBySlug(payload, slug, draft, contentLocale)` for live draft and preview post detail reads
- `findPostSitemapDocs(payload)` for sitemap generation
- `countPublishedPosts(payload, where?)` for archive counts

### Pages

- `findPublicPageRoute(payload, slug, locale)` for published Page reads from the catch-all route
- `findPageBySlug(payload, slug, draft, contentLocale)` for live Page draft and preview reads
- `findPageSitemapDocs(payload)` for sitemap generation

## Usage rules

- Keep presentation mapping in `normalizePost` or route adapters.
- Prefer the shared helpers when the query shape is reused.
- Keep one-off, feature-specific queries local if they are not reused.
- Keep published post detail reads in the public Data Cache with `collection:posts` and `slug:posts:<slug>` tags. The cache key includes the read version, slug, and requested locale.
- Keep draft and preview post detail reads live. The dynamic `/posts/[slug]` route memoizes one request-scoped resolver across page and metadata rendering without placing request-bound draft state in the public Data Cache.

## Localized Page and Post reads

Pages and Posts use Payload publication status per locale. Public detail reads use the language in the URL and
disable Payload content fallback. The route data links published equivalents by document identity. During the Post
rollout, both English routes can serve a migrated article while German is unpublished. The original unprefixed URL
remains canonical and stays in the sitemap until German is published. Each published language then has its own
canonical URL. [Routing and SEO](../adrs/022-adr-public-localization-routing-seo-and-domain-strategy.md) ·
[Native locale publication](../adrs/038-adr-native-payload-locale-publication.md)

Page detail reads stay live. Post detail reads use the public Data Cache. Published slug changes and withdrawals refresh
affected URLs and discovery output through the [Website revalidation flow](../engineering/cache-revalidation-runtime.md#surface-ownership).
