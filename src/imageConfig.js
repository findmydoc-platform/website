/**
 * Centralized Next/Image configuration for non-Next runtimes (Storybook, Vitest)
 *
 * Purpose:
 * - Provide a single source-of-truth for image `quality` values and localPatterns
 *   that Next.js (v16+) will require to be explicitly configured.
 * - Allow Storybook and Vitest to mimic Next's `next.config.js` by applying
 *   the config to `globalThis.__NEXT_IMAGE_OPTS` via `applyNextImageConfigGlobals`.
 *
 * Usage:
 * - `DEFAULT_IMAGE_QUALITY`: preferred default quality for app images.
 * - `IMAGE_QUALITIES`: list of allowed quality integer values used across the
 *    repo (add any intentionally-used explicit values here, e.g. 100).
 * - `IMAGE_LOCAL_PATTERNS`: patterns for local images and story assets that
 *    should be allowed by `images.localPatterns`.
 * - `applyNextImageConfigGlobals(config)`: call this from Storybook/Vitest to
 *    register the options that Next reads at runtime.
 *
 * Verification:
 * - Run `pnpm build-storybook` and `pnpm vitest --project storybook --run`
 *   to confirm there are no Next/Image warnings about localPatterns or qualities.
 */

export const DEFAULT_IMAGE_QUALITY = 70

export const IMAGE_QUALITIES = [DEFAULT_IMAGE_QUALITY, 75]

export const STORYBOOK_IMAGE_LOCAL_PATTERN = {
  pathname: '/src/stories/assets/**',
  search: '?*',
}

export const IMAGE_LOCAL_PATTERNS = [
  {
    pathname: '/**',
    search: '?*',
  },
  STORYBOOK_IMAGE_LOCAL_PATTERN,
]

/**
 * Apply image config to the globals Next/Image reads in Storybook and Vitest.
 * Intended for non-Next runtimes that don't hydrate next.config.js automatically.
 */
export const applyNextImageConfigGlobals = (config) => {
  if (typeof globalThis === 'undefined') return

  const globalWithNextImageConfig = globalThis
  globalWithNextImageConfig.__NEXT_IMAGE_OPTS = config
  globalWithNextImageConfig.__NEXT_IMAGE_OPTS_NO_SSR = config

  // Next/Image reads config via `process.env.__NEXT_IMAGE_OPTS` in client bundles.
  // In Storybook/Vitest (browser), `process` is typically a polyfill object.
  // Avoid writing to Node's real `process.env` (string-only) by only creating
  // a lightweight polyfill when we are in a browser-like runtime.
  const isBrowserRuntime = typeof globalWithNextImageConfig.window !== 'undefined'
  if (!isBrowserRuntime) return

  const existingProcess = globalWithNextImageConfig.process
  const isNodeProcess =
    typeof existingProcess === 'object' &&
    existingProcess !== null &&
    typeof existingProcess.versions === 'object' &&
    existingProcess.versions !== null &&
    typeof existingProcess.versions.node === 'string'

  if (isNodeProcess) return

  if (typeof globalWithNextImageConfig.process !== 'object' || globalWithNextImageConfig.process === null) {
    globalWithNextImageConfig.process = { env: {} }
  }

  if (typeof globalWithNextImageConfig.process.env !== 'object' || globalWithNextImageConfig.process.env === null) {
    globalWithNextImageConfig.process.env = {}
  }

  globalWithNextImageConfig.process.env.__NEXT_IMAGE_OPTS = config
}
