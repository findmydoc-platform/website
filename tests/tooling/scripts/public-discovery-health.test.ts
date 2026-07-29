import { describe, expect, it, vi } from 'vitest'

import {
  extractSitemapLocations,
  parseArgs,
  runPublicDiscoveryHealthCheck,
} from '../../../scripts/public-discovery-health.mjs'

const createResponse = (body: string, status = 200): Response => new Response(body, { status })
const SITEMAP_NAMESPACE = 'http://www.sitemaps.org/schemas/sitemap/0.9'
const EMPTY_SITEMAP_XML = `<urlset xmlns="${SITEMAP_NAMESPACE}"></urlset>`

describe('public discovery health script', () => {
  it('parses base URL arguments', () => {
    expect(parseArgs(['--', '--base-url', 'https://findmydoc.eu']).baseUrl).toBe('https://findmydoc.eu')
    expect(parseArgs(['--base-url=https://preview.findmydoc.eu']).baseUrl).toBe('https://preview.findmydoc.eu')
  })

  it('extracts sitemap locations from namespaced XML', () => {
    expect(
      extractSitemapLocations(`<?xml version="1.0" encoding="UTF-8"?>
        <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
          <url><loc>https://findmydoc.eu/</loc></url>
          <url>
            <loc> https://findmydoc.eu/posts/example </loc>
            <image:image><image:loc>https://cdn.example.com/example.jpg</image:loc></image:image>
          </url>
        </urlset>
      `),
    ).toEqual(['https://findmydoc.eu/', 'https://findmydoc.eu/posts/example'])
  })

  it('accepts a valid empty sitemap', () => {
    expect(extractSitemapLocations('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>')).toEqual([])
  })

  it('rejects malformed sitemap XML', () => {
    expect(() => extractSitemapLocations('<urlset><url><loc>https://findmydoc.eu/</url></urlset>')).toThrow()
  })

  it('reports malformed sitemap XML and continues checking discovery endpoints', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'GET' && url.endsWith('/pages-sitemap.xml')) {
        return createResponse('<urlset><url><loc>https://findmydoc.eu/</url></urlset>')
      }
      if (init?.method === 'GET' && url.endsWith('/posts-sitemap.xml')) {
        return createResponse(EMPTY_SITEMAP_XML)
      }
      return createResponse('', 200)
    })

    const result = await runPublicDiscoveryHealthCheck({
      baseUrl: 'https://findmydoc.eu',
      fetchImpl,
    })

    expect(result.ok).toBe(false)
    expect(result.failures).toContainEqual({
      kind: 'sitemap-xml',
      path: '/pages-sitemap.xml',
      status: 'invalid-xml',
      url: 'https://findmydoc.eu/pages-sitemap.xml',
    })
    expect(fetchImpl).toHaveBeenCalledWith('https://findmydoc.eu/posts-sitemap.xml', {
      method: 'GET',
      redirect: 'follow',
    })
  })

  it('passes when discovery endpoints and sitemap URLs are reachable', async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'GET' && url.endsWith('/pages-sitemap.xml')) {
        return createResponse(
          `<urlset xmlns="${SITEMAP_NAMESPACE}"><url><loc>https://findmydoc.eu/</loc></url></urlset>`,
        )
      }
      if (init?.method === 'GET' && url.endsWith('/sitemap.xml')) {
        return createResponse(`<sitemapindex xmlns="${SITEMAP_NAMESPACE}"></sitemapindex>`)
      }
      if (init?.method === 'GET' && url.endsWith('/posts-sitemap.xml')) {
        return createResponse(
          `<urlset xmlns="${SITEMAP_NAMESPACE}"><url><loc>https://findmydoc.eu/posts/example</loc></url></urlset>`,
        )
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
        return createResponse(
          `<urlset xmlns="${SITEMAP_NAMESPACE}"><url><loc>https://findmydoc.eu/missing</loc></url></urlset>`,
        )
      }
      if (init?.method === 'GET' && url.endsWith('/posts-sitemap.xml')) {
        return createResponse(EMPTY_SITEMAP_XML)
      }
      if (init?.method === 'GET' && url.endsWith('/sitemap.xml')) {
        return createResponse(`<sitemapindex xmlns="${SITEMAP_NAMESPACE}"></sitemapindex>`)
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
        return createResponse(
          `<urlset xmlns="${SITEMAP_NAMESPACE}"><url><loc>https://findmydoc.eu/head-not-allowed</loc></url></urlset>`,
        )
      }
      if (init?.method === 'GET' && url.endsWith('/posts-sitemap.xml')) {
        return createResponse(EMPTY_SITEMAP_XML)
      }
      if (init?.method === 'GET' && url.endsWith('/sitemap.xml')) {
        return createResponse(`<sitemapindex xmlns="${SITEMAP_NAMESPACE}"></sitemapindex>`)
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
        return createResponse(
          `<urlset xmlns="${SITEMAP_NAMESPACE}"><url><loc>https://other.example.com/private</loc></url></urlset>`,
        )
      }
      if (init?.method === 'GET' && url.endsWith('/posts-sitemap.xml')) {
        return createResponse(EMPTY_SITEMAP_XML)
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
