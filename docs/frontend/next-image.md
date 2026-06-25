# Next/Image configuration

## Overview

Next.js (v16+) requires explicit configuration for `images.localPatterns` and
`images.qualities`. This repository centralizes those values so Storybook and
Vitest can mimic Next's runtime expectations, reducing noise and preventing
future build warnings or failures.

## What this provides

- `DEFAULT_IMAGE_QUALITY` — preferred default numeric quality for app images.
- `IMAGE_QUALITIES` — allowed `quality` integer values used across the repo.
- `IMAGE_LOCAL_PATTERNS` — patterns that match local app images used by Next.js.
- `applyNextImageConfigGlobals(config)` — helper that registers the options on
  `globalThis.__NEXT_IMAGE_OPTS` for non-Next runtimes (Storybook, Vitest).

The canonical source for these exports is `src/imageConfig.js`.

## Guidelines — when to change what

- Add a quality value to `IMAGE_QUALITIES` only when a component, story, or
  media policy intentionally requires it.
- Prefer using `DEFAULT_IMAGE_QUALITY` for new image usages unless there's a
  clear visual/functional reason to override it.
- For CMS media, prefer `resolveMediaImage` usage policies over local hard-coded
  quality values. See `docs/frontend/image-pipeline.md`.
- If you add runtime app assets, use `public/images/**` or the relevant media
  collection path so `IMAGE_LOCAL_PATTERNS` stays production-safe.
- If you add story assets outside `src/stories/assets/**`, extend the
  Storybook-only `localPatterns` in `.storybook/preview.tsx` and
  `.storybook/vitest.setup.js`. Do not add Storybook-only paths to
  `IMAGE_LOCAL_PATTERNS`.

## How Storybook & Vitest use this

Storybook's preview and the Vitest setup import `src/imageConfig.js`, patch the
default Next image config, and call `applyNextImageConfigGlobals(patchedConfig)`
during startup. That populates `globalThis.__NEXT_IMAGE_OPTS` so Next/Image
behaves consistently in those environments.

## Verification

Run these commands locally to confirm there are no Next/Image warnings:

```bash
pnpm build-storybook
pnpm vitest --project storybook --run
```

If you see warnings like:

- "is using a query string which is not configured in images.localPatterns"
- "quality "100" which is not configured in images.qualities"

then follow the guidelines above to add the required pattern or quality to
`src/imageConfig.js`.

## Notes

- Keep `IMAGE_QUALITIES` intentionally small — add only values that are used by
  delivery policies or explicit component needs.
- Document any intentional deviations (for example, editorial images that must
  remain at `quality={100}`) in the component or story where they are used.
