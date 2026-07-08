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

const COMPLETED_JOB_STATUSES = new Set<SeedRunJobRecord['status']>(['succeeded', 'failed', 'cancelled', 'skipped'])

const PUBLIC_GLOBALS = [
  'header',
  'footer',
  'landingPages',
  'cookieConsent',
] as const satisfies readonly CachePolicyGlobal[]

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
  treatments: { surfaces: ['listing-comparison', 'partners-clinics'] },
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
}

const isPublicAffectingJob = (job: SeedRunJobRecord): boolean => {
  if (job.kind === 'reset') return true
  if (job.kind === 'globals') return true
  if (!isTaggableCollection(job.collection)) return false

  return typeof COLLECTION_FLUSH_SCOPE[job.collection] !== 'undefined'
}

const hasCompletedOrWritten = (job: SeedRunJobRecord): boolean => {
  return COMPLETED_JOB_STATUSES.has(job.status) || job.created > 0 || job.updated > 0
}

const buildScopeFromCompletedPublicJobs = (
  record: SeedRunRecord,
): { completedJobCount: number; publicJobs: SeedRunJobRecord[]; scope: SeedFinalFlushScope } => {
  const scope = createScope()
  const completedJobs = record.jobs.filter(hasCompletedOrWritten)
  const publicJobs = completedJobs.filter((job) => isPublicAffectingJob(job))

  for (const job of publicJobs) {
    addJobScope(scope, job, record.type)
  }

  return {
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
    id: `${runId}-seed-final-flush-${severity.toLowerCase()}`,
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

export const finalizeSeedRunPublicCaches = async (payload: Payload, snapshot: SeedRunSnapshot): Promise<void> => {
  if (!['completed', 'partial', 'failed', 'cancelled'].includes(snapshot.status)) {
    return
  }

  const record = await loadSeedRunRecord(payload, snapshot.runId)
  if (!record || record.finalFlush) return

  const terminalStatus = snapshot.status as FlushableSeedRunStatus
  const { completedJobCount, publicJobs, scope } = buildScopeFromCompletedPublicJobs(record)

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
        completedJobCount,
        publicJobCount: publicJobs.length,
      },
    })
    const result = executeRevalidationPlan(plan, { logger: payload.logger })

    await markFinalFlush(payload, snapshot.runId, {
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
    await markFinalFlush(payload, snapshot.runId, {
      status: 'failed',
      tagCount: 0,
      pathCount: 0,
      failureCount: 1,
      reason: 'planner-error',
    })
    await appendFinalFlushLog(payload, snapshot.runId, 'Seed final cache flush failed', 'WARN')
  }
}
