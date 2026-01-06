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
