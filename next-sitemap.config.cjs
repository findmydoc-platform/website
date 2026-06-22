const SITE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'https://example.com'

const normalizeEnvValue = (value) => {
  if (!value) return null

  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

const isPreviewRuntime =
  (normalizeEnvValue(process.env.VERCEL_ENV) ?? normalizeEnvValue(process.env.DEPLOYMENT_ENV)) === 'preview'
const blockSearchIndexing = isPreviewRuntime

const PUBLIC_DISCOVERY_USER_AGENTS = [
  'Googlebot',
  'bingbot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'Claude-SearchBot',
  'Claude-User',
]

const BLOCKED_MODEL_TRAINING_USER_AGENTS = ['GPTBot', 'ClaudeBot', 'Google-Extended']

const PUBLIC_DISCOVERY_POLICY = {
  allow: '/',
  disallow: ['/admin', '/admin/*'],
}

const productionRobotsPolicies = [
  ...PUBLIC_DISCOVERY_USER_AGENTS.map((userAgent) => ({
    userAgent,
    ...PUBLIC_DISCOVERY_POLICY,
  })),
  ...BLOCKED_MODEL_TRAINING_USER_AGENTS.map((userAgent) => ({
    userAgent,
    disallow: '/',
  })),
  {
    userAgent: '*',
    ...PUBLIC_DISCOVERY_POLICY,
  },
]

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
        : productionRobotsPolicies,
    ].flat(),
    additionalSitemaps: blockSearchIndexing ? [] : [`${SITE_URL}/pages-sitemap.xml`, `${SITE_URL}/posts-sitemap.xml`],
  },
}
