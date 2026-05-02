const SITE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://example.com'

const normalizeEnvValue = (value) => {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

const isPreviewRuntime =
  (normalizeEnvValue(process.env.VERCEL_ENV) ??
    normalizeEnvValue(process.env.DEPLOYMENT_ENV) ??
    normalizeEnvValue(process.env.NODE_ENV)) === 'preview'
const isTemporaryLandingModeEnabled = ['1', 'on', 'true', 'yes'].includes(
  normalizeEnvValue(process.env.TEMPORARY_LANDING_MODE_ENABLED) ?? '',
)
const blockSearchIndexing = isPreviewRuntime || isTemporaryLandingModeEnabled

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,
  generateRobotsTxt: true,
  exclude: ['/posts-sitemap.xml', '/pages-sitemap.xml', '/*', '/posts/*'],
  robotsTxtOptions: {
    policies: [
      blockSearchIndexing
        ? {
            userAgent: '*',
            disallow: '/',
          }
        : {
            userAgent: '*',
            disallow: '/admin/*',
          },
    ],
    additionalSitemaps: blockSearchIndexing ? [] : [`${SITE_URL}/pages-sitemap.xml`, `${SITE_URL}/posts-sitemap.xml`],
  },
}
