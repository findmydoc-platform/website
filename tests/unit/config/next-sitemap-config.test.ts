import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { IConfig } from 'next-sitemap'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const configPath = path.resolve(process.cwd(), 'next-sitemap.config.cjs')

const loadConfig = (): IConfig & {
  robotsTxtOptions: {
    additionalSitemaps: string[]
    policies: Array<{ allow?: string; disallow: string | string[]; userAgent: string }>
  }
} => {
  delete require.cache[require.resolve(configPath)]
  return require(configPath)
}

const generateRobots = async (config: IConfig): Promise<string> => {
  const builderUrl = pathToFileURL(
    path.join(path.dirname(require.resolve('next-sitemap')), '../esm/builders/exportable-builder.js'),
  )
  const { ExportableBuilder } = await import(builderUrl.href)
  const builder = new ExportableBuilder(
    { ...config, generateIndexSitemap: true, outDir: 'public' },
    {
      SITEMAP_INDEX_FILE: 'sitemap.xml',
      SITEMAP_INDEX_URL: `${config.siteUrl}/sitemap.xml`,
    },
  )
  await builder.registerIndexSitemap()
  await builder.registerRobotsTxt()
  return (
    builder.exportableList.find((item: { type: string; content: string }) => item.type === 'robots.txt')?.content ?? ''
  )
}

const publicDiscoveryUserAgents = [
  'Googlebot',
  'bingbot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'Claude-SearchBot',
  'Claude-User',
]

const blockedModelTrainingUserAgents = ['GPTBot', 'ClaudeBot', 'Google-Extended']

describe('next-sitemap config', () => {
  const originalEnv = process.env

  afterEach(() => {
    delete require.cache[require.resolve(configPath)]
    process.env = originalEnv
  })

  it('announces only the reachable direct sitemaps in generated Production robots', async () => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENVIRONMENT: undefined,
      NEXT_PUBLIC_SERVER_URL: 'https://findmydoc.eu',
      VERCEL_ENV: 'production',
    }

    const config = loadConfig()
    const robots = await generateRobots(config)
    expect(robots.split('\n').filter((line) => line.startsWith('Sitemap:'))).toEqual([
      'Sitemap: https://findmydoc.eu/pages-sitemap.xml',
      'Sitemap: https://findmydoc.eu/posts-sitemap.xml',
    ])

    for (const userAgent of publicDiscoveryUserAgents) {
      expect(config.robotsTxtOptions.policies).toContainEqual({
        allow: '/',
        disallow: ['/admin', '/admin/*'],
        userAgent,
      })
    }
    expect(config.robotsTxtOptions.policies).toContainEqual({
      allow: '/',
      disallow: ['/admin', '/admin/*'],
      userAgent: '*',
    })
    expect(config.robotsTxtOptions.additionalSitemaps).toEqual([
      'https://findmydoc.eu/pages-sitemap.xml',
      'https://findmydoc.eu/posts-sitemap.xml',
    ])
  })

  it('blocks model training crawlers outside preview runtime', () => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENVIRONMENT: undefined,
      NEXT_PUBLIC_SERVER_URL: 'https://findmydoc.eu',
      VERCEL_ENV: 'production',
    }

    const config = loadConfig()

    for (const userAgent of blockedModelTrainingUserAgents) {
      expect(config.robotsTxtOptions.policies).toContainEqual({
        disallow: '/',
        userAgent,
      })
    }
  })

  it('blocks robots and hides all generated sitemap references in Vercel preview runtime', async () => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENVIRONMENT: undefined,
      NEXT_PUBLIC_SERVER_URL: 'https://findmydoc.eu',
      VERCEL_ENV: 'preview',
    }

    const config = loadConfig()

    expect(await generateRobots(config)).not.toMatch(/^Sitemap:/m)
    expect(config.robotsTxtOptions.policies).toEqual([{ disallow: '/', userAgent: '*' }])
    expect(config.robotsTxtOptions.additionalSitemaps).toEqual([])
  })

  it('blocks robots and hides sitemap references in explicit preview runtime', () => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENVIRONMENT: 'preview',
      NEXT_PUBLIC_SERVER_URL: 'https://findmydoc.eu',
      VERCEL_ENV: undefined,
    }

    const config = loadConfig()

    expect(config.robotsTxtOptions.policies).toEqual([{ disallow: '/', userAgent: '*' }])
    expect(config.robotsTxtOptions.additionalSitemaps).toEqual([])
  })

  it('does not block robots only because the configured site URL uses the preview host', () => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENVIRONMENT: undefined,
      NEXT_PUBLIC_SERVER_URL: 'https://preview.findmydoc.eu',
      VERCEL_ENV: 'production',
    }

    const config = loadConfig()

    expect(config.robotsTxtOptions.policies).toContainEqual({
      allow: '/',
      disallow: ['/admin', '/admin/*'],
      userAgent: '*',
    })
    expect(config.robotsTxtOptions.additionalSitemaps).toEqual([
      'https://preview.findmydoc.eu/pages-sitemap.xml',
      'https://preview.findmydoc.eu/posts-sitemap.xml',
    ])
  })
})
