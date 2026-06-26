#!/usr/bin/env node

import { pathToFileURL } from 'node:url'

export const DEFAULT_PUBLIC_DISCOVERY_BASE_URL = 'http://localhost:3000'

export const PUBLIC_DISCOVERY_HEALTH_PATHS = [
  '/robots.txt',
  '/sitemap.xml',
  '/pages-sitemap.xml',
  '/posts-sitemap.xml',
  '/llms.txt',
  '/.well-known/llms.txt',
]

const SITEMAP_PATHS = new Set(['/pages-sitemap.xml', '/posts-sitemap.xml'])

export function parseArgs(argv = process.argv.slice(2)) {
  const options = {
    baseUrl: process.env.BASE_URL || DEFAULT_PUBLIC_DISCOVERY_BASE_URL,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--') continue

    if (arg === '--base-url') {
      const value = argv[index + 1]
      if (!value) throw new Error('--base-url requires a value')
      options.baseUrl = value
      index += 1
      continue
    }

    const inlineBaseUrl = arg.match(/^--base-url=(.+)$/u)
    if (inlineBaseUrl) {
      options.baseUrl = inlineBaseUrl[1]
      continue
    }

    if (arg === '--help') {
      return {
        ...options,
        help: true,
      }
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return options
}

export function buildAbsoluteUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString()
}

export function extractSitemapLocations(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/giu)]
    .map((match) => match[1]?.trim())
    .filter((location) => typeof location === 'string' && location.length > 0)
}

async function fetchWithGetFallback(url, fetchImpl) {
  const headResponse = await fetchImpl(url, {
    method: 'HEAD',
    redirect: 'follow',
  })

  if (headResponse.status !== 405) return headResponse

  return fetchImpl(url, {
    method: 'GET',
    redirect: 'follow',
  })
}

async function readText(url, fetchImpl) {
  const response = await fetchImpl(url, {
    method: 'GET',
    redirect: 'follow',
  })
  const text = await response.text()

  return {
    response,
    text,
  }
}

export async function runPublicDiscoveryHealthCheck({
  baseUrl = DEFAULT_PUBLIC_DISCOVERY_BASE_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('A fetch implementation is required.')
  }

  const checked = []
  const failures = []

  for (const path of PUBLIC_DISCOVERY_HEALTH_PATHS) {
    const url = buildAbsoluteUrl(baseUrl, path)
    const { response, text } = await readText(url, fetchImpl)
    checked.push({ path, status: response.status, url })

    if (!response.ok) {
      failures.push({
        kind: 'discovery-surface',
        path,
        status: response.status,
        url,
      })
      continue
    }

    if (!SITEMAP_PATHS.has(path)) continue

    for (const location of extractSitemapLocations(text)) {
      const sitemapUrl = new URL(location, baseUrl)
      const base = new URL(baseUrl)
      if (sitemapUrl.origin !== base.origin) {
        failures.push({
          kind: 'sitemap-url',
          path: sitemapUrl.pathname,
          status: 'cross-origin',
          url: `${sitemapUrl.origin}${sitemapUrl.pathname}`,
        })
        continue
      }

      const sitemapUrlString = sitemapUrl.toString()
      const sitemapResponse = await fetchWithGetFallback(sitemapUrlString, fetchImpl)
      checked.push({ path: sitemapUrl.pathname, status: sitemapResponse.status, url: sitemapUrlString })

      if (!sitemapResponse.ok) {
        failures.push({
          kind: 'sitemap-url',
          path: sitemapUrl.pathname,
          status: sitemapResponse.status,
          url: `${sitemapUrl.origin}${sitemapUrl.pathname}`,
        })
      }
    }
  }

  return {
    checked,
    failures,
    ok: failures.length === 0,
  }
}

function printHelp() {
  console.log(`Usage: pnpm discovery:health -- --base-url <url>

Checks public discovery entrypoints and sitemap URLs.

Options:
  --base-url <url>  Base URL to check. Defaults to ${DEFAULT_PUBLIC_DISCOVERY_BASE_URL}.
  --help            Show this help.
`)
}

export async function runPublicDiscoveryHealthCli(argv = process.argv.slice(2)) {
  const options = parseArgs(argv)
  if (options.help) {
    printHelp()
    return 0
  }

  const result = await runPublicDiscoveryHealthCheck({ baseUrl: options.baseUrl })

  for (const item of result.checked) {
    console.log(`${item.status} ${item.url}`)
  }

  if (!result.ok) {
    console.error('\nPublic discovery health check failed:')
    for (const failure of result.failures) {
      console.error(`${failure.status} ${failure.kind} ${failure.url}`)
    }
    return 1
  }

  console.log('\nPublic discovery health check passed.')
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runPublicDiscoveryHealthCli().then(
    (exitCode) => {
      process.exitCode = exitCode
    },
    (error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 1
    },
  )
}
