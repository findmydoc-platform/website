import { createRequire } from 'node:module'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const configPath = path.resolve(process.cwd(), 'next-sitemap.config.cjs')

const loadConfig = (): {
  robotsTxtOptions: {
    additionalSitemaps: string[]
    policies: Array<{ allow?: string; disallow: string | string[]; userAgent: string }>
  }
} => {
  delete require.cache[require.resolve(configPath)]
  return require(configPath)
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

  it('includes sitemap references outside preview runtime', () => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENV: undefined,
      NEXT_PUBLIC_SERVER_URL: 'https://findmydoc.eu',
      VERCEL_ENV: 'production',
    }

    const config = loadConfig()

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
      DEPLOYMENT_ENV: undefined,
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

  it('blocks robots and hides sitemap references in Vercel preview runtime', () => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENV: undefined,
      NEXT_PUBLIC_SERVER_URL: 'https://preview.findmydoc.eu',
      VERCEL_ENV: 'preview',
    }

    const config = loadConfig()

    expect(config.robotsTxtOptions.policies).toEqual([{ disallow: '/', userAgent: '*' }])
    expect(config.robotsTxtOptions.additionalSitemaps).toEqual([])
  })

  it('blocks robots and hides sitemap references in explicit preview runtime', () => {
    process.env = {
      ...originalEnv,
      DEPLOYMENT_ENV: 'preview',
      NEXT_PUBLIC_SERVER_URL: 'https://preview.findmydoc.eu',
      VERCEL_ENV: undefined,
    }

    const config = loadConfig()

    expect(config.robotsTxtOptions.policies).toEqual([{ disallow: '/', userAgent: '*' }])
    expect(config.robotsTxtOptions.additionalSitemaps).toEqual([])
  })
})
