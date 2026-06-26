import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  buildCrawlerRequestLogContext,
  classifyCrawlerUserAgent,
  logCrawlerRequest,
} from '@/features/publicDiscovery/crawlerMonitoring'

describe('public discovery crawler monitoring', () => {
  const originalEnv = process.env

  afterEach(() => {
    process.env = originalEnv
  })

  it('classifies search, user-directed AI, and model-training crawlers', () => {
    expect(classifyCrawlerUserAgent('Mozilla/5.0 compatible; Googlebot/2.1')).toEqual({
      crawlerClass: 'search-and-answer-indexing',
      crawlerName: 'Googlebot',
    })
    expect(classifyCrawlerUserAgent('ChatGPT-User/1.0')).toEqual({
      crawlerClass: 'user-directed-ai-retrieval',
      crawlerName: 'ChatGPT-User',
    })
    expect(classifyCrawlerUserAgent('Mozilla/5.0 AppleWebKit Google-Extended')).toEqual({
      crawlerClass: 'model-training-control',
      crawlerName: 'Google-Extended',
    })
  })

  it('ignores ordinary browser user agents', () => {
    expect(classifyCrawlerUserAgent('Mozilla/5.0 Safari/605.1.15')).toBeNull()
    expect(classifyCrawlerUserAgent(null)).toBeNull()
  })

  it('builds coarse request context without query strings or sensitive headers', () => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'production',
      VERCEL_ENV: 'production',
    }

    const context = buildCrawlerRequestLogContext(
      new Request('https://findmydoc.eu/llms.txt?token=secret', {
        headers: {
          authorization: 'Bearer secret',
          cookie: 'session=secret',
          'user-agent': 'PerplexityBot/1.0',
        },
        method: 'POST',
      }),
    )

    expect(context).toMatchObject({
      crawlerClass: 'search-and-answer-indexing',
      crawlerName: 'PerplexityBot',
      event: 'public_discovery.crawler.requested',
      host: 'findmydoc.eu',
      method: 'POST',
      path: '/llms.txt',
      scope: 'public_discovery',
    })
    expect(JSON.stringify(context)).not.toContain('secret')
    expect(JSON.stringify(context)).not.toContain('token')
  })

  it('logs recognized crawler requests through the supplied logger', () => {
    const logger = {
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    }

    logCrawlerRequest(
      new Request('https://findmydoc.eu/llms.txt', {
        headers: {
          'user-agent': 'Claude-SearchBot',
        },
      }),
      logger,
    )

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        crawlerName: 'Claude-SearchBot',
        event: 'public_discovery.crawler.requested',
        path: '/llms.txt',
        scope: 'public_discovery',
      }),
      'Public discovery crawler request observed',
    )
  })

  it('does not log crawler requests for paths outside the public discovery surface set', () => {
    const logger = {
      debug: vi.fn(),
      error: vi.fn(),
      fatal: vi.fn(),
      info: vi.fn(),
      level: 'info',
      trace: vi.fn(),
      warn: vi.fn(),
    }

    logCrawlerRequest(
      new Request('https://findmydoc.eu/admin/account', {
        headers: {
          'user-agent': 'Googlebot/2.1',
        },
      }),
      logger,
    )

    expect(logger.info).not.toHaveBeenCalled()
  })
})
