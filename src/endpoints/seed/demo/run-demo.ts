import type { Payload, PayloadRequest } from 'payload'
import type { BasicUser } from '@/payload-types'
import { createStableIdResolvers } from '../utils/resolvers'
import { importCollection } from '../utils/import-collection'
import { demoPlan } from '../utils/plan'
import { resetCollections } from '../utils/reset'
import type { SeedRunSummary, SeedUnitSummary } from '../baseline/run-baseline'
import type { SeedRecord } from '../utils/load-json'
import { loadSeedFile } from '../utils/load-json'

export type DemoRunSummary = SeedRunSummary

async function applyPostRelations(
  payload: Payload,
  resolvers: ReturnType<typeof createStableIdResolvers>,
): Promise<SeedUnitSummary> {
  const warnings: string[] = []
  const failures: string[] = []
  let updated = 0
  const created = 0

  const records = await loadSeedFile('demo', 'posts')

  for (const rawRecord of records) {
    const record = rawRecord as SeedRecord & { relatedPostsStableIds?: unknown }
    const stableId = typeof record.stableId === 'string' ? record.stableId : null
    if (!stableId) continue

    const postId = await resolvers.resolveIdByStableId('posts', stableId)
    if (!postId) {
      warnings.push(`Missing posts stableId for posts relations: ${stableId}`)
      continue
    }
    const postNumericId = typeof postId === 'number' ? postId : Number(postId)
    if (!Number.isFinite(postNumericId)) {
      warnings.push(`Invalid posts id for posts relations:${stableId}: ${String(postId)}`)
      continue
    }

    const relationStableIds = Array.isArray(record.relatedPostsStableIds)
      ? record.relatedPostsStableIds.filter((value): value is string => typeof value === 'string')
      : []

    const dedupedStableIds = Array.from(new Set(relationStableIds)).filter((value) => value !== stableId)
    const { ids, missing } = await resolvers.resolveManyIdsByStableIds('posts', dedupedStableIds)
    const relatedIds = ids
      .filter((id) => String(id) !== String(postId))
      .map((id) => (typeof id === 'number' ? id : Number(id)))
      .filter((id): id is number => Number.isFinite(id))

    if (missing.length > 0) {
      warnings.push(`Missing posts stableIds for posts:${stableId}: ${missing.join(', ')}`)
    }

    try {
      await payload.update({
        collection: 'posts',
        id: postNumericId,
        data: { relatedPosts: relatedIds },
        trash: true,
        overrideAccess: true,
        context: { disableRevalidate: true, disableSearchSync: true },
      })
      updated += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`Failed posts relations:${stableId}: ${message}`)
    }
  }

  return {
    name: 'posts-relations',
    created,
    updated,
    warnings,
    failures,
  }
}

export async function runDemoSeeds(payload: Payload, options: { reset?: boolean } = {}): Promise<DemoRunSummary> {
  const { reset = false } = options
  const resolvers = createStableIdResolvers(payload)
  const units: SeedUnitSummary[] = []
  const warnings: string[] = []
  const failures: string[] = []

  if (reset) {
    await resetCollections(payload, 'demo')
  }

  for (const step of demoPlan) {
    payload.logger.info(`Running demo seed: ${step.name}`)

    try {
      if (step.kind !== 'collection') {
        continue
      }

      let req: Partial<PayloadRequest> | undefined
      if ('reqUserStableId' in step && step.reqUserStableId) {
        const userId = await resolvers.resolveIdByStableId('basicUsers', step.reqUserStableId)
        if (!userId) {
          warnings.push(`Missing basicUsers for demo seed reqUserStableId: ${step.reqUserStableId}`)
        } else {
          const userDoc = (await payload.findByID({
            collection: 'basicUsers',
            id: userId,
            overrideAccess: true,
          })) as BasicUser
          req = { user: { ...userDoc, collection: 'basicUsers' } as NonNullable<PayloadRequest['user']> }
        }
      }

      const result = await importCollection({
        payload,
        kind: 'demo',
        collection: step.collection,
        fileName: step.fileName,
        mapping: step.mapping,
        context: 'context' in step ? step.context : undefined,
        resolvers,
        req,
      })
      const { name: _ignoredName, ...rest } = result
      units.push({ name: step.name, ...rest })
      warnings.push(...result.warnings)
      failures.push(...result.failures)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`Demo seed ${step.name} failed: ${message}`)
    }
  }

  // Apply related posts after all posts exist, so every stableId can resolve.
  try {
    const relationResult = await applyPostRelations(payload, resolvers)
    units.push(relationResult)
    warnings.push(...relationResult.warnings)
    failures.push(...relationResult.failures)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failures.push(`Demo seed posts-relations failed: ${message}`)
  }

  return { units, warnings, failures }
}
