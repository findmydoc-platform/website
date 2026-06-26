import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { createScopedLogger, getDeploymentEnv, type ServerLogger } from '@/utilities/logging/shared'
import { PUBLIC_DISCOVERY_SURFACE_PATHS } from './site'

export type PublicDiscoveryCrawlerClass =
  | 'model-training-control'
  | 'search-and-answer-indexing'
  | 'user-directed-ai-retrieval'

export type PublicDiscoveryCrawlerMatch = {
  crawlerClass: PublicDiscoveryCrawlerClass
  crawlerName: string
}

export type PublicDiscoveryCrawlerRequestLogContext = PublicDiscoveryCrawlerMatch & {
  deploymentEnv: string
  event: 'public_discovery.crawler.requested'
  host: string
  method: string
  path: string
  scope: 'public_discovery'
}

type RequestLike = {
  headers: Pick<Headers, 'get'>
  method?: string
  nextUrl?: Pick<URL, 'hostname' | 'pathname'>
  url?: string
}

const PUBLIC_DISCOVERY_SURFACE_PATH_SET = new Set<string>(PUBLIC_DISCOVERY_SURFACE_PATHS)

const CRAWLER_MATCHERS = [
  {
    crawlerClass: 'search-and-answer-indexing',
    crawlerName: 'Googlebot',
    pattern: /googlebot/iu,
  },
  {
    crawlerClass: 'search-and-answer-indexing',
    crawlerName: 'bingbot',
    pattern: /bingbot/iu,
  },
  {
    crawlerClass: 'search-and-answer-indexing',
    crawlerName: 'OAI-SearchBot',
    pattern: /oai-searchbot/iu,
  },
  {
    crawlerClass: 'user-directed-ai-retrieval',
    crawlerName: 'ChatGPT-User',
    pattern: /chatgpt-user/iu,
  },
  {
    crawlerClass: 'search-and-answer-indexing',
    crawlerName: 'PerplexityBot',
    pattern: /perplexitybot/iu,
  },
  {
    crawlerClass: 'user-directed-ai-retrieval',
    crawlerName: 'Perplexity-User',
    pattern: /perplexity-user/iu,
  },
  {
    crawlerClass: 'search-and-answer-indexing',
    crawlerName: 'Claude-SearchBot',
    pattern: /claude-searchbot/iu,
  },
  {
    crawlerClass: 'user-directed-ai-retrieval',
    crawlerName: 'Claude-User',
    pattern: /claude-user/iu,
  },
  {
    crawlerClass: 'model-training-control',
    crawlerName: 'GPTBot',
    pattern: /gptbot/iu,
  },
  {
    crawlerClass: 'model-training-control',
    crawlerName: 'ClaudeBot',
    pattern: /claudebot/iu,
  },
  {
    crawlerClass: 'model-training-control',
    crawlerName: 'Google-Extended',
    pattern: /google-extended/iu,
  },
] as const satisfies readonly (PublicDiscoveryCrawlerMatch & { pattern: RegExp })[]

const normalizeMethod = (method: string | undefined): string => {
  const normalizedMethod = method?.trim().toUpperCase()
  return normalizedMethod || 'GET'
}

const resolveRequestUrl = (request: RequestLike): Pick<URL, 'hostname' | 'pathname'> | null => {
  if (request.nextUrl) return request.nextUrl
  if (!request.url) return null

  try {
    return new URL(request.url)
  } catch {
    return null
  }
}

export const classifyCrawlerUserAgent = (userAgent: string | null | undefined): PublicDiscoveryCrawlerMatch | null => {
  if (!userAgent) return null

  for (const matcher of CRAWLER_MATCHERS) {
    if (matcher.pattern.test(userAgent)) {
      return {
        crawlerClass: matcher.crawlerClass,
        crawlerName: matcher.crawlerName,
      }
    }
  }

  return null
}

export const buildCrawlerRequestLogContext = (request: RequestLike): PublicDiscoveryCrawlerRequestLogContext | null => {
  const crawler = classifyCrawlerUserAgent(request.headers.get('user-agent'))
  if (!crawler) return null

  const requestUrl = resolveRequestUrl(request)
  if (!requestUrl) return null
  if (!PUBLIC_DISCOVERY_SURFACE_PATH_SET.has(requestUrl.pathname)) return null

  return {
    ...crawler,
    deploymentEnv: getDeploymentEnv(),
    event: 'public_discovery.crawler.requested',
    host: requestUrl.hostname,
    method: normalizeMethod(request.method),
    path: requestUrl.pathname || '/',
    scope: 'public_discovery',
  }
}

export const logCrawlerRequest = (request: RequestLike, logger: ServerLogger = fallbackConsoleLogger): void => {
  const context = buildCrawlerRequestLogContext(request)
  if (!context) return

  createScopedLogger(logger, {
    scope: 'public_discovery',
  }).info(context, 'Public discovery crawler request observed')
}
