import type { AuthData } from '@/auth/types/authTypes'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import { fallbackConsoleLogger } from '@/utilities/logging/consoleLogger'
import { createScopedLogger, toLoggedError, type ServerLogger } from '@/utilities/logging/shared'
import { FeatureFlagEvaluations, type FeatureFlagEvaluations as PostHogFeatureFlagEvaluations } from 'posthog-node'
import {
  getPostHogFeatureFlagServer,
  getPostHogServer,
  isPostHogLocalEvaluationConfigured,
  schedulePostHogFeatureFlagServerIdleShutdown,
} from './server'
import { extractPostHogDistinctIdFromCookieHeader, readHeader, sendRequestErrorToPostHog } from './telemetry'

export type PostHogActorType = 'anonymous' | 'patient' | 'clinic' | 'platform'

export type PostHogScalarProperty = string | number | boolean | null

export type PostHogActor = {
  distinctId: string
  email?: string
  groupProperties?: Record<string, Record<string, string>>
  groups?: Record<string, string>
  isAuthenticated: boolean
  personProperties: Record<string, string | undefined>
  userType: PostHogActorType
}

export type PostHogFlagDefinition = {
  defaultValue: boolean | string
  description: string
  variants?: readonly string[]
}

export const POSTHOG_FLAG_REGISTRY = {
  'temporary-landing-mode': {
    defaultValue: false,
    description: 'Controls temporary public landing-mode rendering in server-side code.',
  },
} as const satisfies Record<string, PostHogFlagDefinition>

export type PostHogFlagKey = keyof typeof POSTHOG_FLAG_REGISTRY

export type PostHogEventDefinition = {
  description: string
}

export const POSTHOG_EVENT_REGISTRY = {
  'clinic profile viewed': {
    description: 'A public clinic profile was rendered or opened.',
  },
} as const satisfies Record<string, PostHogEventDefinition>

export type PostHogEventName = keyof typeof POSTHOG_EVENT_REGISTRY

export type PostHogFlagSnapshot = {
  getPayload<T>(key: PostHogFlagKey, fallback: T): T
  getVariant<T extends string>(key: PostHogFlagKey, fallback: T): T
  isEnabled(key: PostHogFlagKey): boolean
  keys: readonly PostHogFlagKey[]
}

type InternalPostHogFlagSnapshot = PostHogFlagSnapshot & {
  readonly rawEvaluations?: PostHogFeatureFlagEvaluations
}

type ResolvePostHogActorInput = {
  authData?: AuthData | null
  clinicId?: number | string | null
  fallbackAnonymousId?: string | null
  headers?: Headers
  logger?: ServerLogger
}

type CapturePostHogEventInput = {
  actor: PostHogActor
  event: PostHogEventName
  flags?: PostHogFlagSnapshot
  flagKeys?: readonly PostHogFlagKey[]
  properties?: Record<string, PostHogScalarProperty | undefined>
}

const logger = createScopedLogger(fallbackConsoleLogger, {
  component: 'posthog-api',
  scope: 'telemetry.posthog',
})

const inFlightFlagEvaluations = new Map<string, Promise<PostHogFlagSnapshot>>()
const identifiedActors = new Set<string>()

const silentPostHogFlagEvaluationHost: ConstructorParameters<typeof FeatureFlagEvaluations>[0]['host'] = {
  captureFlagCalledEventIfNeeded: () => undefined,
  logWarning(message: string): void {
    logger.warn(
      {
        event: 'telemetry.posthog.flags_snapshot_warning',
      },
      message,
    )
  },
}

const isNodeRuntime = (): boolean => process.env.NEXT_RUNTIME !== 'edge'

const normalizeIdentifier = (value: number | string | null | undefined): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value === 'string' && value.trim().length > 0) return value.trim()
  return undefined
}

const toPostHogActorFromAuthData = (authData: AuthData, clinicId?: number | string | null): PostHogActor => {
  const normalizedClinicId = normalizeIdentifier(clinicId)
  const groups = normalizedClinicId ? { clinic: normalizedClinicId } : undefined
  const groupProperties = normalizedClinicId ? { clinic: { id: normalizedClinicId } } : undefined

  return {
    distinctId: authData.supabaseUserId,
    email: authData.userEmail,
    groupProperties,
    groups,
    isAuthenticated: true,
    personProperties: {
      email: authData.userEmail,
      first_name: authData.firstName,
      is_authenticated: 'true',
      last_name: authData.lastName,
      user_type: authData.userType,
    },
    userType: authData.userType,
  }
}

const toAnonymousPostHogActor = ({
  fallbackAnonymousId,
  headers,
}: {
  fallbackAnonymousId?: string | null
  headers?: Headers
}): PostHogActor => {
  const cookieDistinctId = extractPostHogDistinctIdFromCookieHeader(headers ? readHeader({ headers }, 'cookie') : null)
  const distinctId = normalizeIdentifier(fallbackAnonymousId) ?? cookieDistinctId ?? 'anonymous'

  return {
    distinctId,
    isAuthenticated: false,
    personProperties: {
      is_authenticated: 'false',
      user_type: 'anonymous',
    },
    userType: 'anonymous',
  }
}

const getFlagDefault = (key: PostHogFlagKey): boolean | string => POSTHOG_FLAG_REGISTRY[key].defaultValue

const createPostHogFlagSnapshot = ({
  keys,
  rawEvaluations,
}: {
  keys: readonly PostHogFlagKey[]
  rawEvaluations?: PostHogFeatureFlagEvaluations
}): PostHogFlagSnapshot => {
  const snapshot: InternalPostHogFlagSnapshot = {
    getPayload<T>(key: PostHogFlagKey, fallback: T): T {
      const payload = rawEvaluations?.getFlagPayload(key)
      return payload === undefined ? fallback : (payload as T)
    },
    getVariant<T extends string>(key: PostHogFlagKey, fallback: T): T {
      const flag = rawEvaluations?.getFlag(key)
      return typeof flag === 'string' ? (flag as T) : fallback
    },
    isEnabled(key: PostHogFlagKey): boolean {
      const flag = rawEvaluations?.getFlag(key)
      if (flag === undefined) {
        return getFlagDefault(key) !== false
      }
      return flag !== false
    },
    keys: [...keys],
    rawEvaluations,
  }

  return snapshot
}

const buildEvaluationCacheKey = (actor: PostHogActor, keys: readonly PostHogFlagKey[]): string => {
  return JSON.stringify({
    distinctId: actor.distinctId,
    groups: actor.groups ?? {},
    keys: [...keys].sort(),
    personProperties: actor.personProperties,
  })
}

const toDefinedStringProperties = (value: Record<string, string | undefined>): Record<string, string> => {
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )
}

const createSilentPostHogFeatureFlagEvaluations = ({
  actor,
  featureFlagPayloads,
  featureFlags,
  keys,
}: {
  actor: PostHogActor
  featureFlagPayloads: Record<string, unknown>
  featureFlags: Record<string, unknown>
  keys: readonly PostHogFlagKey[]
}): PostHogFeatureFlagEvaluations => {
  type FeatureFlagRecords = ConstructorParameters<typeof FeatureFlagEvaluations>[0]['flags']
  type FeatureFlagRecordPayload = FeatureFlagRecords[string]['payload']

  const records: FeatureFlagRecords = {}

  for (const key of keys) {
    const hasPostHogValue = Object.prototype.hasOwnProperty.call(featureFlags, key)
    const flag = hasPostHogValue ? featureFlags[key] : getFlagDefault(key)
    if (typeof flag !== 'boolean' && typeof flag !== 'string') continue

    records[key] = {
      enabled: flag !== false,
      id: undefined,
      key,
      locallyEvaluated: hasPostHogValue,
      payload: hasPostHogValue ? (featureFlagPayloads[key] as FeatureFlagRecordPayload) : undefined,
      reason: hasPostHogValue ? 'Evaluated locally' : 'Code default',
      variant: typeof flag === 'string' ? flag : undefined,
      version: undefined,
    }
  }

  return new FeatureFlagEvaluations({
    disableGeoip: true,
    distinctId: actor.distinctId,
    flags: records,
    groups: actor.groups,
    host: silentPostHogFlagEvaluationHost,
  })
}

export async function resolvePostHogActor(input: ResolvePostHogActorInput = {}): Promise<PostHogActor> {
  if (input.authData) {
    return toPostHogActorFromAuthData(input.authData, input.clinicId)
  }

  const authData = await extractSupabaseUserData({ headers: input.headers, logger: input.logger })
  if (authData) {
    return toPostHogActorFromAuthData(authData, input.clinicId)
  }

  return toAnonymousPostHogActor({
    fallbackAnonymousId: input.fallbackAnonymousId,
    headers: input.headers,
  })
}

export async function evaluatePostHogFlags(
  actor: PostHogActor,
  keys: readonly PostHogFlagKey[],
): Promise<PostHogFlagSnapshot> {
  if (keys.length === 0 || !isNodeRuntime() || !isPostHogLocalEvaluationConfigured()) {
    return createPostHogFlagSnapshot({ keys })
  }

  const cacheKey = buildEvaluationCacheKey(actor, keys)
  const existing = inFlightFlagEvaluations.get(cacheKey)
  if (existing) return existing

  const evaluation = (async () => {
    try {
      const client = getPostHogFeatureFlagServer()
      const localFlags = await client.getAllFlagsAndPayloads(actor.distinctId, {
        disableGeoip: true,
        flagKeys: [...keys],
        groupProperties: actor.groupProperties,
        groups: actor.groups,
        onlyEvaluateLocally: true,
        personProperties: toDefinedStringProperties(actor.personProperties),
      })
      const rawEvaluations = createSilentPostHogFeatureFlagEvaluations({
        actor,
        featureFlagPayloads: localFlags.featureFlagPayloads ?? {},
        featureFlags: localFlags.featureFlags ?? {},
        keys,
      })

      return createPostHogFlagSnapshot({ keys, rawEvaluations })
    } catch (error) {
      logger.warn(
        {
          err: toLoggedError(error),
          event: 'telemetry.posthog.flags_evaluate_failed',
        },
        'PostHog feature flag evaluation failed; using code defaults',
      )
      return createPostHogFlagSnapshot({ keys })
    } finally {
      inFlightFlagEvaluations.delete(cacheKey)
      schedulePostHogFeatureFlagServerIdleShutdown()
    }
  })()

  inFlightFlagEvaluations.set(cacheKey, evaluation)
  return evaluation
}

export function capturePostHogEvent({ actor, event, flagKeys, flags, properties }: CapturePostHogEventInput): void {
  if (!isNodeRuntime()) return

  try {
    const client = getPostHogServer()
    const internalFlags = flags as InternalPostHogFlagSnapshot | undefined
    const rawFlags = internalFlags?.rawEvaluations
    const captureFlags = rawFlags ? (flagKeys ? rawFlags.only([...flagKeys]) : rawFlags.onlyAccessed()) : undefined

    client.capture({
      distinctId: actor.distinctId,
      event,
      flags: captureFlags,
      groups: actor.groups,
      properties,
    })
  } catch (error) {
    logger.warn(
      {
        err: toLoggedError(error),
        event: 'telemetry.posthog.capture_failed',
      },
      'PostHog event capture failed; continuing',
    )
  }
}

export async function identifyPostHogActor(actor: PostHogActor): Promise<void> {
  if (!actor.isAuthenticated || identifiedActors.has(actor.distinctId) || !isNodeRuntime()) {
    return
  }

  try {
    const client = getPostHogServer()
    client.identify({
      distinctId: actor.distinctId,
      properties: {
        ...actor.personProperties,
        email: actor.email,
      },
    })

    identifiedActors.add(actor.distinctId)
  } catch (error) {
    logger.warn(
      {
        err: toLoggedError(error),
        event: 'telemetry.posthog.identify_failed',
        supabaseUserId: actor.distinctId,
      },
      'Failed to identify actor in PostHog',
    )
  }
}

export function resetPostHogClientForTests(): void {
  identifiedActors.clear()
  inFlightFlagEvaluations.clear()
}

export async function sendPostHogRequestError(err: unknown, request: unknown): Promise<void> {
  await sendRequestErrorToPostHog(err, request)
}
