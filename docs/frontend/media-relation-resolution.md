# Media Relation Resolution

## Why this exists

In Payload, media relations can arrive either as:

- a populated object (already containing `url` / `alt`)
- only an ID

If we only handle the populated case, UI can silently fall back to placeholders.
If we only handle the ID case, we risk inconsistent access behavior.

## Standard approach in this repository

Use the shared helper in:

- `src/utilities/media/relationMedia.ts`

This helper provides one consistent flow:

1. Read media from relation object when already populated.
2. When `url` is missing but `filename` is present, derive `/api/<collection>/file/<filename>`.
3. If relation is only an ID, resolve media by ID.
4. Return a simple descriptor (`url`, `alt`) for UI mapping.

## Where it is used now

- Blog author avatars in:
  - `src/collections/Posts/hooks/populateAuthors.ts` via the virtual `posts.populatedAuthors` field
- Listing comparison clinic thumbnails in:
  - `src/utilities/listingComparison/serverData/presentation.ts`

## Rule for future media features

For new media-relation based features, use `relationMedia.ts` instead of writing one-off logic.
This keeps behavior consistent across collections, hooks, and server data pipelines.
