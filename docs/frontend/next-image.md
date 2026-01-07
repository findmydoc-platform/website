# Next/Image configuration

## Overview

Next.js (v16+) requires explicit configuration for `images.localPatterns` and
`images.qualities`. This repository centralizes those values so Storybook and
Vitest can mimic Next's runtime expectations, reducing noise and preventing
future build warnings or failures.

## What this provides

- `DEFAULT_IMAGE_QUALITY` — preferred default numeric quality for app images.
- `IMAGE_QUALITIES` — allowed `quality` integer values used across the repo.
- `IMAGE_LOCAL_PATTERNS` — patterns that match local story assets and app images.
- `applyNextImageConfigGlobals(config)` — helper that registers the options on
  `globalThis.__NEXT_IMAGE_OPTS` for non-Next runtimes (Storybook, Vitest).

The canonical source for these exports is `src/imageConfig.js`.

## Guidelines — when to change what

- Add a quality value to `IMAGE_QUALITIES` only when a component or story
  intentionally requires a non-default `quality` (for example `100`).
- Prefer using `DEFAULT_IMAGE_QUALITY` for new image usages unless there's a
  clear visual/functional reason to override it.
- If you add story assets outside `src/stories/assets/**`, extend
  `IMAGE_LOCAL_PATTERNS` with a specific, minimal pattern that matches those
  files.

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

- Keep `IMAGE_QUALITIES` intentionally small — add only values that are used.
- Document any intentional deviations (for example, editorial images that must
  remain at `quality={100}`) in the component or story where they are used.
