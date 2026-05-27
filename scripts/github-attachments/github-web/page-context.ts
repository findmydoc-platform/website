import { DEFAULT_USER_AGENT } from '../config'
import type { GitHubPageContext, GitHubTarget } from '../types'

const extractMeta = (html: string, name: string): string | undefined => {
  const pattern = new RegExp(`<meta\\s+[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i')
  return html.match(pattern)?.[1]
}

const extractRepositoryId = (html: string): string | undefined => {
  const patterns = [
    /"repository"\s*:\s*\{[^{}]*"databaseId"\s*:\s*(\d+)/,
    /"repositoryId"\s*:\s*(\d+)/,
    /"repository_id"\s*:\s*"?(\d+)"?/,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) {
      return match[1]
    }
  }

  return undefined
}

const extractClientVersion = (html: string): string | undefined => {
  return (
    extractMeta(html, 'current-catalog-service-hash') ??
    html.match(/"clientVersion"\s*:\s*"([a-f0-9]{40})"/i)?.[1] ??
    html.match(/"client_version"\s*:\s*"([a-f0-9]{40})"/i)?.[1]
  )
}

export const fetchGitHubPageContext = async (
  target: GitHubTarget,
  cookieHeader: string,
): Promise<GitHubPageContext> => {
  const response = await fetch(target.url, {
    headers: {
      accept: 'text/html',
      cookie: cookieHeader,
      'user-agent': DEFAULT_USER_AGENT,
    },
    redirect: 'follow',
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch GitHub target page: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const fetchNonce = extractMeta(html, 'fetch-nonce')

  if (!fetchNonce) {
    throw new Error('Could not extract GitHub fetch nonce from target page')
  }

  return {
    clientVersion: extractClientVersion(html),
    cookieHeader,
    fetchNonce,
    referer: target.url,
    repositoryId: extractRepositoryId(html),
    target,
  }
}
