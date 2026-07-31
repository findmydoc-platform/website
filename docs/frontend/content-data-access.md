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
- `getCachedPublishedPostBySlug(options)` for published post detail reads
- `findPostBySlug(payload, slug, draft, contentLocale)` for live draft and preview post detail reads
- `findPostSitemapDocs(payload)` for sitemap generation
- `countPublishedPosts(payload, where?)` for archive counts

### Pages

- `findPageBySlug(payload, slug, draft)` for the catch-all page route
- `findPageSlugs(payload)` for `generateStaticParams`
- `findPageSitemapDocs(payload)` for sitemap generation

## Usage rules

- Keep presentation mapping in `normalizePost` or route adapters.
- Prefer the shared helpers when the query shape is reused.
- Keep one-off, feature-specific queries local if they are not reused.
- Keep published post detail reads in the public Data Cache with `collection:posts` and `slug:posts:<slug>` tags. The cache key includes its version, slug, locale, and fallback locale.
- Keep draft and preview post detail reads live. The dynamic `/posts/[slug]` route memoizes one request-scoped resolver across page and metadata rendering without placing request-bound draft state in the public Data Cache.
