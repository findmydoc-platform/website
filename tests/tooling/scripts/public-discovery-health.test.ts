import { describe, expect, it, vi } from 'vitest'

import {
  extractSitemapLocations,
  parseArgs,
  runPublicDiscoveryHealthCheck,
} from '../../../scripts/public-discovery-health.mjs'

const createResponse = (body: string, status = 200): Response => new Response(body, { status })

describe('public discovery health script', () => {
  it('parses base URL arguments', () => {
    expect(parseArgs(['--', '--base-url', 'https://findmydoc.eu']).baseUrl).toBe('https://findmydoc.eu')
    expect(parseArgs(['--base-url=https://preview.findmydoc.eu']).baseUrl).toBe('https://preview.findmydoc.eu')
  })

  it('extracts sitemap locations from XML', () => {
    expect(
      extractSitemapLocations(`
        <urlset>
          <url><loc>https://findmydoc.eu/</loc></url>
          <url><loc> https://findmydoc.eu/posts/example </loc></url>
        </urlset>
      `),
    ).toEqual(['https://findmydoc.eu/', 'https://findmydoc.eu/posts/example'])
  })

  it('passes when discovery endpoints and sitemap URLs are reachable', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'GET' && url.endsWith('/pages-sitemap.xml')) {
        return createResponse('<urlset><url><loc>https://findmydoc.eu/</loc></url></urlset>')
      }
      if (init?.method === 'GET' && url.endsWith('/sitemap.xml')) {
        return createResponse('<sitemapindex></sitemapindex>')
      }
      if (init?.method === 'GET' && url.endsWith('/posts-sitemap.xml')) {
        return createResponse('<urlset><url><loc>https://findmydoc.eu/posts/example</loc></url></urlset>')
      }
      return createResponse('', 200)
    })

    const result = await runPublicDiscoveryHealthCheck({
      baseUrl: 'https://findmydoc.eu',
      fetchImpl,
    })

    expect(result.ok).toBe(true)
    expect(result.failures).toEqual([])
    expect(fetchImpl).toHaveBeenCalledWith('https://findmydoc.eu/', {
      method: 'HEAD',
      redirect: 'follow',
    })
  })

  it('fails when a sitemap URL returns 404', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'GET' && url.endsWith('/pages-sitemap.xml')) {
        return createResponse('<urlset><url><loc>https://findmydoc.eu/missing</loc></url></urlset>')
      }
      if (init?.method === 'GET' && url.endsWith('/sitemap.xml')) {
        return createResponse('<sitemapindex></sitemapindex>')
      }
      if (url.endsWith('/missing')) return createResponse('', 404)
      return createResponse('', 200)
    })

    const result = await runPublicDiscoveryHealthCheck({
      baseUrl: 'https://findmydoc.eu',
      fetchImpl,
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toContainEqual({
      kind: 'sitemap-url',
      path: '/missing',
      status: 404,
      url: 'https://findmydoc.eu/missing',
    })
  })

  it('falls back to GET when a sitemap URL rejects HEAD', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'GET' && url.endsWith('/pages-sitemap.xml')) {
        return createResponse('<urlset><url><loc>https://findmydoc.eu/head-not-allowed</loc></url></urlset>')
      }
      if (init?.method === 'GET' && url.endsWith('/sitemap.xml')) {
        return createResponse('<sitemapindex></sitemapindex>')
      }
      if (url.endsWith('/head-not-allowed') && init?.method === 'HEAD') return createResponse('', 405)
      return createResponse('', 200)
    })

    const result = await runPublicDiscoveryHealthCheck({
      baseUrl: 'https://findmydoc.eu',
      fetchImpl,
    })

    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith('https://findmydoc.eu/head-not-allowed', {
      method: 'GET',
      redirect: 'follow',
    })
  })

  it('fails without fetching cross-origin sitemap URLs', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'GET' && url.endsWith('/pages-sitemap.xml')) {
        return createResponse('<urlset><url><loc>https://other.example.com/private</loc></url></urlset>')
      }
      return createResponse('', 200)
    })

    const result = await runPublicDiscoveryHealthCheck({
      baseUrl: 'https://findmydoc.eu',
      fetchImpl,
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toContainEqual({
      kind: 'sitemap-url',
      path: '/private',
      status: 'cross-origin',
      url: 'https://other.example.com/private',
    })
    expect(fetchImpl).not.toHaveBeenCalledWith('https://other.example.com/private', expect.anything())
  })
})
