import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const runtimeCache = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}))

const getCache = vi.hoisted(() => vi.fn(() => runtimeCache))

vi.mock('@vercel/functions', () => ({
  getCache,
}))

describe('PostHog flag definition runtime cache provider', () => {
  const oldEnv = process.env

  const cachedDefinitions = {
    cohorts: {},
    flags: [],
    groupTypeMapping: {},
  }

  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    runtimeCache.get.mockResolvedValue(null)
    runtimeCache.set.mockResolvedValue(undefined)
    process.env = {
      ...oldEnv,
      VERCEL: '1',
    }
  })

  afterEach(() => {
    process.env = oldEnv
  })

  it('returns undefined outside Vercel so the SDK can use in-memory caching locally', async () => {
    delete process.env.VERCEL

    const { createPostHogFlagDefinitionCacheProvider } = await import('@/posthog/flag-definition-cache')

    expect(
      createPostHogFlagDefinitionCacheProvider({
        host: 'https://eu.i.posthog.com',
        projectKey: 'phc_test',
      }),
    ).toBeUndefined()
    expect(getCache).not.toHaveBeenCalled()
  })

  it('reads cached flag definitions and skips remote fetches on cache hits', async () => {
    runtimeCache.get.mockResolvedValue(cachedDefinitions)

    const { createPostHogFlagDefinitionCacheProvider, POSTHOG_FLAG_DEFINITION_CACHE_NAMESPACE } =
      await import('@/posthog/flag-definition-cache')

    const provider = createPostHogFlagDefinitionCacheProvider({
      host: 'https://eu.i.posthog.com',
      projectKey: 'phc_test',
    })

    await expect(provider?.getFlagDefinitions()).resolves.toBe(cachedDefinitions)
    await expect(provider?.shouldFetchFlagDefinitions()).resolves.toBe(false)
    expect(getCache).toHaveBeenCalledWith({ namespace: POSTHOG_FLAG_DEFINITION_CACHE_NAMESPACE })
  })

  it('allows remote fetches when no cached definitions exist', async () => {
    const { createPostHogFlagDefinitionCacheProvider } = await import('@/posthog/flag-definition-cache')

    const provider = createPostHogFlagDefinitionCacheProvider({
      host: 'https://eu.i.posthog.com',
      projectKey: 'phc_test',
    })

    await expect(provider?.getFlagDefinitions()).resolves.toBeUndefined()
    await expect(provider?.shouldFetchFlagDefinitions()).resolves.toBe(true)
  })

  it('writes received flag definitions with the configured 120 second TTL', async () => {
    const {
      createPostHogFlagDefinitionCacheProvider,
      POSTHOG_FLAG_DEFINITION_CACHE_TAG,
      POSTHOG_FLAG_DEFINITION_CACHE_TTL_SECONDS,
    } = await import('@/posthog/flag-definition-cache')

    const provider = createPostHogFlagDefinitionCacheProvider({
      host: 'https://eu.i.posthog.com',
      projectKey: 'phc_test',
    })

    await provider?.onFlagDefinitionsReceived(cachedDefinitions)

    expect(runtimeCache.set).toHaveBeenCalledWith(expect.any(String), cachedDefinitions, {
      name: POSTHOG_FLAG_DEFINITION_CACHE_TAG,
      tags: [POSTHOG_FLAG_DEFINITION_CACHE_TAG],
      ttl: POSTHOG_FLAG_DEFINITION_CACHE_TTL_SECONDS,
    })
    expect(POSTHOG_FLAG_DEFINITION_CACHE_TTL_SECONDS).toBe(120)
  })
})
