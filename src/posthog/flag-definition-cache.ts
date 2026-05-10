import { getCache } from '@vercel/functions'
import { createHash } from 'node:crypto'
import type { FlagDefinitionCacheData, FlagDefinitionCacheProvider } from 'posthog-node/experimental'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { createScopedLogger, toLoggedError } from '@/utilities/logging/shared'

export const POSTHOG_FLAG_DEFINITION_CACHE_NAMESPACE = 'posthog-feature-flags'
export const POSTHOG_FLAG_DEFINITION_CACHE_TAG = 'posthog-feature-flag-definitions'
export const POSTHOG_FLAG_DEFINITION_CACHE_TTL_SECONDS = 120

const logger = createScopedLogger(fallbackConsoleLogger, {
  component: 'posthog-flag-definition-cache',
  scope: 'telemetry.posthog',
})

type RuntimeCache = ReturnType<typeof getCache>

type CreatePostHogFlagDefinitionCacheProviderInput = {
  host: string
  projectKey: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const isFlagDefinitionCacheData = (value: unknown): value is FlagDefinitionCacheData => {
  return isRecord(value) && Array.isArray(value.flags) && isRecord(value.groupTypeMapping) && isRecord(value.cohorts)
}

const buildFlagDefinitionsCacheKey = ({ host, projectKey }: CreatePostHogFlagDefinitionCacheProviderInput): string => {
  const digest = createHash('sha256').update(`${host}:${projectKey}`).digest('hex').slice(0, 24)
  return `definitions:${digest}`
}

const isVercelRuntime = (): boolean => process.env.VERCEL === '1'

class VercelPostHogFlagDefinitionCacheProvider implements FlagDefinitionCacheProvider {
  private readonly cache: RuntimeCache
  private readonly cacheKey: string

  constructor(input: CreatePostHogFlagDefinitionCacheProviderInput) {
    this.cache = getCache({ namespace: POSTHOG_FLAG_DEFINITION_CACHE_NAMESPACE })
    this.cacheKey = buildFlagDefinitionsCacheKey(input)
  }

  async getFlagDefinitions(): Promise<FlagDefinitionCacheData | undefined> {
    try {
      const cached = await this.cache.get(this.cacheKey)
      return isFlagDefinitionCacheData(cached) ? cached : undefined
    } catch (error) {
      logger.warn(
        {
          err: toLoggedError(error),
          event: 'telemetry.posthog.flag_definitions_cache_read_failed',
        },
        'Failed to read PostHog flag definitions from runtime cache',
      )
      return undefined
    }
  }

  async shouldFetchFlagDefinitions(): Promise<boolean> {
    const cached = await this.getFlagDefinitions()
    return cached === undefined
  }

  async onFlagDefinitionsReceived(data: FlagDefinitionCacheData): Promise<void> {
    try {
      await this.cache.set(this.cacheKey, data, {
        name: POSTHOG_FLAG_DEFINITION_CACHE_TAG,
        tags: [POSTHOG_FLAG_DEFINITION_CACHE_TAG],
        ttl: POSTHOG_FLAG_DEFINITION_CACHE_TTL_SECONDS,
      })
    } catch (error) {
      logger.warn(
        {
          err: toLoggedError(error),
          event: 'telemetry.posthog.flag_definitions_cache_write_failed',
        },
        'Failed to write PostHog flag definitions to runtime cache',
      )
    }
  }

  shutdown(): void {
    // Runtime Cache does not keep process-local resources open.
  }
}

export function createPostHogFlagDefinitionCacheProvider(
  input: CreatePostHogFlagDefinitionCacheProviderInput,
): FlagDefinitionCacheProvider | undefined {
  if (!isVercelRuntime()) return undefined

  return new VercelPostHogFlagDefinitionCacheProvider(input)
}
