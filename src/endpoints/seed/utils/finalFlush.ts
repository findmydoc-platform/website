import { randomUUID } from 'crypto'
import type { Payload } from 'payload'

import {
  CACHE_TAGGABLE_COLLECTIONS,
  CACHE_TAGGABLE_SURFACE_IDS,
  type CachePolicyGlobal,
  type CacheSitemapId,
  type CacheTaggableCollection,
  type CacheTaggableSurfaceId,
} from '@/utilities/cachePolicy'
import { executeRevalidationPlan, planRevalidation } from '@/utilities/cacheRevalidation'
import { getCurrentIsoTimestampString } from '@/utilities/timestamps'
import { baselinePlan, demoPlan } from './plan'
import type { SeedType } from './runtime'
import {
  appendSeedRunLog,
  loadSeedRunRecord,
  markSeedRunFinalFlush,
  type SeedLogEntry,
  type SeedRunFinalFlushRecord,
  type SeedRunJobRecord,
  type SeedRunRecord,
  type SeedRunSnapshot,
} from './state'

type FlushableSeedRunStatus = Extract<SeedRunSnapshot['status'], 'completed' | 'partial' | 'failed' | 'cancelled'>

type SeedFinalFlushScope = {
  collections: Set<CacheTaggableCollection>
  globals: Set<CachePolicyGlobal>
  surfaces: Set<CacheTaggableSurfaceId>
  sitemaps: Set<CacheSitemapId>
}

type ScopeEntry = {
  readonly surfaces?: readonly CacheTaggableSurfaceId[]
  readonly sitemaps?: readonly CacheSitemapId[]
}

type PostgresLockClient = {
  query: (text: string, params?: readonly unknown[]) => Promise<{ rows?: Array<{ acquired?: unknown }> }>
  release: () => void
}

type PayloadWithOptionalPostgresPool = Payload & {
  db?: {
    pool?: {
      connect?: () => Promise<PostgresLockClient>
    }
  }
}

type FinalFlushClaim = {
  release: () => Promise<void>
}

const PUBLIC_GLOBALS = [
  'header',
  'footer',
  'landingPages',
  'cookieConsent',
] as const satisfies readonly CachePolicyGlobal[]

const activeFinalFlushRunIds = new Set<string>()

const isFinalFlushComplete = (finalFlush: SeedRunFinalFlushRecord | undefined): boolean => {
  return Boolean(finalFlush && finalFlush.status !== 'failed')
}

const GLOBAL_FLUSH_SCOPE: Record<CachePolicyGlobal, ScopeEntry> = {
  header: { surfaces: ['public-chrome'] },
  footer: { surfaces: ['public-chrome'] },
  landingPages: { surfaces: ['home', 'about', 'partners-clinics'], sitemaps: ['pages'] },
  cookieConsent: { surfaces: ['public-chrome'] },
}

const COLLECTION_FLUSH_SCOPE: Partial<Record<CacheTaggableCollection, ScopeEntry>> = {
  pages: { sitemaps: ['pages'] },
  posts: { surfaces: ['posts-list', 'home', 'partners-clinics'], sitemaps: ['posts'] },
  redirects: { surfaces: ['redirects'] },
  clinics: { surfaces: ['clinic-detail', 'listing-comparison'], sitemaps: ['pages'] },
  clinictreatments: { surfaces: ['clinic-detail', 'listing-comparison'], sitemaps: ['pages'] },
  doctors: { surfaces: ['clinic-detail'] },
  doctorspecialties: { surfaces: ['clinic-detail'] },
  doctortreatments: { surfaces: ['clinic-detail'] },
  reviews: { surfaces: ['clinic-detail', 'listing-comparison'], sitemaps: ['pages'] },
  accreditation: { surfaces: ['clinic-detail'] },
  clinicGalleryEntries: { surfaces: ['clinic-detail'] },
  treatments: { surfaces: ['listing-comparison', 'partners-clinics'], sitemaps: ['pages'] },
  'medical-specialties': { surfaces: ['listing-comparison', 'home', 'partners-clinics'], sitemaps: ['pages'] },
  cities: { surfaces: ['listing-comparison', 'home'], sitemaps: ['pages'] },
  countries: { surfaces: ['listing-comparison'] },
  categories: { surfaces: ['listing-comparison'] },
  tags: { surfaces: ['listing-comparison'] },
  clinicMedia: {},
  clinicGalleryMedia: {},
  doctorMedia: {},
  platformContentMedia: {},
}

const isTaggableCollection = (collection: string | undefined): collection is CacheTaggableCollection => {
  return CACHE_TAGGABLE_COLLECTIONS.includes(collection as CacheTaggableCollection)
}

const isTaggableSurface = (surface: string): surface is CacheTaggableSurfaceId => {
  return CACHE_TAGGABLE_SURFACE_IDS.includes(surface as CacheTaggableSurfaceId)
}

const createScope = (): SeedFinalFlushScope => ({
  collections: new Set(),
  globals: new Set(),
  surfaces: new Set(),
  sitemaps: new Set(),
})

const addGlobalScope = (scope: SeedFinalFlushScope, global: CachePolicyGlobal): void => {
  scope.globals.add(global)

  const entry = GLOBAL_FLUSH_SCOPE[global]
  for (const surface of entry.surfaces ?? []) {
    scope.surfaces.add(surface)
  }
  for (const sitemap of entry.sitemaps ?? []) {
    scope.sitemaps.add(sitemap)
  }
}

const addCollectionScope = (scope: SeedFinalFlushScope, collection: CacheTaggableCollection): void => {
  scope.collections.add(collection)

  const entry = COLLECTION_FLUSH_SCOPE[collection]
  for (const surface of entry?.surfaces ?? []) {
    if (isTaggableSurface(surface)) {
      scope.surfaces.add(surface)
    }
  }
  for (const sitemap of entry?.sitemaps ?? []) {
    scope.sitemaps.add(sitemap)
  }
}

const addPlanScope = (scope: SeedFinalFlushScope, seedType: SeedType): void => {
  const plan = seedType === 'baseline' ? baselinePlan : demoPlan

  for (const step of plan) {
    if (step.kind === 'globals') {
      for (const global of PUBLIC_GLOBALS) {
        addGlobalScope(scope, global)
      }
      continue
    }

    if (isTaggableCollection(step.collection)) {
      addCollectionScope(scope, step.collection)
    }

    if (step.collection === 'platformStaff' || step.collection === 'userProfileMedia') {
      addCollectionScope(scope, 'posts')
    }
  }
}

const addJobScope = (scope: SeedFinalFlushScope, job: SeedRunJobRecord, seedType: SeedType): void => {
  if (job.kind === 'reset') {
    addPlanScope(scope, seedType)
    return
  }

  if (job.kind === 'globals') {
    for (const global of PUBLIC_GLOBALS) {
      addGlobalScope(scope, global)
    }
    return
  }

  if (isTaggableCollection(job.collection)) {
    addCollectionScope(scope, job.collection)
  }

  if (job.collection === 'platformStaff' || job.collection === 'userProfileMedia') {
    addCollectionScope(scope, 'posts')
  }
}

const isPublicAffectingJob = (job: SeedRunJobRecord): boolean => {
  if (job.kind === 'reset') return true
  if (job.kind === 'globals') return true
  if (!isTaggableCollection(job.collection)) return false

  return typeof COLLECTION_FLUSH_SCOPE[job.collection] !== 'undefined'
}

const hasCompletedOrWritten = (job: SeedRunJobRecord): boolean => {
  if (job.created > 0 || job.updated > 0) return true
  return job.status === 'succeeded'
}

const buildScopeFromCompletedPublicJobs = (
  record: SeedRunRecord,
): {
  affectedPostSlugs: string[]
  completedJobCount: number
  publicJobs: SeedRunJobRecord[]
  scope: SeedFinalFlushScope
} => {
  const scope = createScope()
  const completedJobs = record.jobs.filter(hasCompletedOrWritten)
  const publicJobs = completedJobs.filter((job) => isPublicAffectingJob(job))

  for (const job of publicJobs) {
    addJobScope(scope, job, record.type)
  }

  const affectedPostSlugs = [
    ...new Set(
      publicJobs.flatMap((job) => {
        const slugs = job.output?.affectedPostSlugs
        return Array.isArray(slugs) ? slugs.filter((slug): slug is string => typeof slug === 'string') : []
      }),
    ),
  ].sort()

  return {
    affectedPostSlugs,
    completedJobCount: completedJobs.length,
    publicJobs,
    scope,
  }
}

const appendFinalFlushLog = async (
  payload: Payload,
  runId: string,
  text: string,
  severity: SeedLogEntry['severity'],
): Promise<void> => {
  await appendSeedRunLog(payload, runId, {
    id: `${runId}-seed-final-flush-${severity.toLowerCase()}-${randomUUID()}`,
    at: getCurrentIsoTimestampString(),
    severity,
    text,
    runId,
    title: 'Seed final cache flush',
    stepName: 'seed-final-flush',
    kind: 'globals',
  })
}

const markFinalFlush = async (
  payload: Payload,
  runId: string,
  finalFlush: Omit<SeedRunFinalFlushRecord, 'completedAt'>,
): Promise<void> => {
  await markSeedRunFinalFlush(payload, runId, {
    ...finalFlush,
    completedAt: getCurrentIsoTimestampString(),
  })
}

const acquireDatabaseFinalFlushLock = async (
  payload: Payload,
  runId: string,
): Promise<(() => Promise<void>) | null | undefined> => {
  const pool = (payload as PayloadWithOptionalPostgresPool).db?.pool
  if (typeof pool?.connect !== 'function') return undefined

  const client = await pool.connect()

  try {
    const result = await client.query('select pg_try_advisory_lock(hashtext($1), hashtext($2)) as acquired', [
      'seed-final-flush',
      runId,
    ])
    const acquired = result.rows?.[0]?.acquired === true

    if (!acquired) {
      client.release()
      return null
    }

    return async () => {
      try {
        await client.query('select pg_advisory_unlock(hashtext($1), hashtext($2))', ['seed-final-flush', runId])
      } finally {
        client.release()
      }
    }
  } catch (error) {
    client.release()
    throw error
  }
}

const claimFinalFlush = async (payload: Payload, runId: string): Promise<FinalFlushClaim | null> => {
  if (activeFinalFlushRunIds.has(runId)) {
    return null
  }

  activeFinalFlushRunIds.add(runId)
  let releaseDatabaseLock: (() => Promise<void>) | undefined

  try {
    const databaseLock = await acquireDatabaseFinalFlushLock(payload, runId)
    if (databaseLock === null) {
      activeFinalFlushRunIds.delete(runId)
      return null
    }
    releaseDatabaseLock = databaseLock
  } catch (error) {
    activeFinalFlushRunIds.delete(runId)
    payload.logger.warn({
      event: 'cache.revalidation.failed',
      operation: 'seed-final-flush',
      source: { kind: 'seed-runner', id: runId },
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }

  const record = await loadSeedRunRecord(payload, runId)
  if (!record || isFinalFlushComplete(record.finalFlush)) {
    if (releaseDatabaseLock) {
      await releaseDatabaseLock()
    }
    activeFinalFlushRunIds.delete(runId)
    return null
  }

  return {
    release: async () => {
      try {
        if (releaseDatabaseLock) {
          await releaseDatabaseLock()
        }
      } finally {
        activeFinalFlushRunIds.delete(runId)
      }
    },
  }
}

const completeFinalFlush = async (
  payload: Payload,
  runId: string,
  finalFlush: Omit<SeedRunFinalFlushRecord, 'completedAt'>,
): Promise<void> => {
  await markSeedRunFinalFlush(payload, runId, {
    ...finalFlush,
    completedAt: getCurrentIsoTimestampString(),
  })
}

export const finalizeSeedRunPublicCaches = async (payload: Payload, snapshot: SeedRunSnapshot): Promise<void> => {
  if (!['completed', 'partial', 'failed', 'cancelled'].includes(snapshot.status)) {
    return
  }

  const record = await loadSeedRunRecord(payload, snapshot.runId)
  if (!record || isFinalFlushComplete(record.finalFlush)) return

  const terminalStatus = snapshot.status as FlushableSeedRunStatus
  const { affectedPostSlugs, completedJobCount, publicJobs, scope } = buildScopeFromCompletedPublicJobs(record)

  if (publicJobs.length === 0) {
    await markFinalFlush(payload, snapshot.runId, {
      status: 'skipped',
      tagCount: 0,
      pathCount: 0,
      failureCount: 0,
      reason: 'no-public-work',
    })
    return
  }

  const claim = await claimFinalFlush(payload, snapshot.runId)
  if (!claim) return

  try {
    const plan = planRevalidation({
      kind: 'seed-final-flush',
      operation: 'seed-final-flush',
      source: {
        kind: 'seed-runner',
        id: snapshot.runId,
      },
      subject: {
        runId: snapshot.runId,
        seedType: record.type,
        reset: record.reset,
        terminalStatus,
        affectedCollections: [...scope.collections].sort(),
        affectedGlobals: [...scope.globals].sort(),
        affectedSurfaces: [...scope.surfaces].sort(),
        affectedSitemaps: [...scope.sitemaps].sort(),
        affectedDiscovery: [],
        affectedPostSlugs,
        completedJobCount,
        publicJobCount: publicJobs.length,
      },
    })
    const result = executeRevalidationPlan(plan, { logger: payload.logger })

    await completeFinalFlush(payload, snapshot.runId, {
      status: result.failures.length > 0 ? 'failed' : 'executed',
      tagCount: result.attempted.tagCount,
      pathCount: result.attempted.pathCount,
      failureCount: result.failures.length,
      ...(result.failures.length > 0 ? { reason: 'executor-error' } : {}),
    })
    await appendFinalFlushLog(
      payload,
      snapshot.runId,
      `Seed final cache flush executed: tags=${result.attempted.tagCount}, paths=${result.attempted.pathCount}, failures=${result.failures.length}`,
      result.failures.length > 0 ? 'WARN' : 'INFO',
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    payload.logger.warn({
      event: 'cache.revalidation.failed',
      operation: 'seed-final-flush',
      source: { kind: 'seed-runner', id: snapshot.runId },
      terminalStatus,
      completedJobCount,
      publicJobCount: publicJobs.length,
      message,
    })
    await completeFinalFlush(payload, snapshot.runId, {
      status: 'failed',
      tagCount: 0,
      pathCount: 0,
      failureCount: 1,
      reason: 'planner-error',
    })
    await appendFinalFlushLog(payload, snapshot.runId, 'Seed final cache flush failed', 'WARN')
  } finally {
    await claim.release()
  }
}
