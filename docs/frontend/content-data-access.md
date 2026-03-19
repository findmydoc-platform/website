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
- `findPostBySlug(payload, slug, draft)` for the post detail route
- `findPostSlugs(payload)` for `generateStaticParams`
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
