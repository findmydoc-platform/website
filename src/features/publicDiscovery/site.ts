export const PUBLIC_CANONICAL_SITE_URL = 'https://findmydoc.eu'

export const PUBLIC_DISCOVERY_AGENT_CONTEXT_PATHS = ['/llms.txt', '/.well-known/llms.txt'] as const

export const PUBLIC_DISCOVERY_SITEMAP_PATHS = ['/pages-sitemap.xml', '/posts-sitemap.xml'] as const

export const PUBLIC_DISCOVERY_SURFACE_PATHS = [
  '/robots.txt',
  ...PUBLIC_DISCOVERY_SITEMAP_PATHS,
  ...PUBLIC_DISCOVERY_AGENT_CONTEXT_PATHS,
] as const

export const toPublicCanonicalUrl = (path: string): string => {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new Error(`Public canonical paths must be root-relative: ${path}`)
  }

  return path === '/' ? `${PUBLIC_CANONICAL_SITE_URL}/` : `${PUBLIC_CANONICAL_SITE_URL}${path.replace(/\/+$/, '')}`
}
