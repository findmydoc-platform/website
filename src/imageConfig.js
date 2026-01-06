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
}
