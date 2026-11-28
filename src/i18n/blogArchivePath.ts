export const BLOG_ARCHIVE_PATHS = { de: '/posts', en: '/en/posts' } as const

export function blogArchiveLocaleFromPath(pathname: string): keyof typeof BLOG_ARCHIVE_PATHS | null {
  if (/^\/posts(?:\/page\/[1-9]\d*)?\/?$/.test(pathname)) return 'de'
  if (/^\/en\/posts(?:\/page\/[1-9]\d*)?\/?$/.test(pathname)) return 'en'
  return null
}
