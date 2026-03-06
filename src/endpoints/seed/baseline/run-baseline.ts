import type { Payload, PayloadRequest } from 'payload'
import { createStableIdResolvers } from '../utils/resolvers'
import { importCollection } from '../utils/import-collection'
import { importGlobals } from '../utils/import-globals'
import { baselinePlan } from '../utils/plan'
import { resetCollections } from '../utils/reset'

export type SeedUnitSummary = {
  name: string
  created: number
  updated: number
  warnings: string[]
  failures: string[]
}

export type SeedRunSummary = {
  units: SeedUnitSummary[]
  warnings: string[]
  failures: string[]
}

async function resolvePlatformSeedActorId(
  payload: Payload,
  req?: Partial<PayloadRequest>,
): Promise<string | number | null> {
  if (req?.user && typeof req.user === 'object' && 'collection' in req.user && 'id' in req.user) {
    const collection = (req.user as { collection?: unknown }).collection
    const id = (req.user as { id?: unknown }).id
    if (collection === 'basicUsers' && (typeof id === 'string' || typeof id === 'number')) {
      return id
    }
  }

  const users = await payload.find({
    collection: 'basicUsers',
    where: { userType: { equals: 'platform' } },
    limit: 1,
    sort: 'createdAt',
    overrideAccess: true,
    depth: 0,
  })

  return users.docs[0]?.id ?? null
}

export async function runBaselineSeeds(
  payload: Payload,
  options: { reset?: boolean; req?: Partial<PayloadRequest> } = {},
): Promise<SeedRunSummary> {
  const { reset = false, req } = options
  const resolvers = createStableIdResolvers(payload)
  const units: SeedUnitSummary[] = []
  const warnings: string[] = []
  const failures: string[] = []
  let platformSeedActorId: string | number | null | undefined

  if (reset) {
    await resetCollections(payload, 'baseline')
  }

  for (const step of baselinePlan) {
    payload.logger.info(`Running baseline seed: ${step.name}`)

    try {
      if (step.kind === 'globals') {
        const result = await importGlobals(payload)
        units.push({ name: step.name, ...result })
        warnings.push(...result.warnings)
        failures.push(...result.failures)
        continue
      }

      if (step.requiresPlatformUser) {
        if (platformSeedActorId === undefined) {
          platformSeedActorId = await resolvePlatformSeedActorId(payload, req)
        }

        if (!platformSeedActorId) {
          const stepWarnings = [`Skipped ${step.name}: no platform basic user available for media attribution.`]
          units.push({ name: step.name, created: 0, updated: 0, warnings: stepWarnings, failures: [] })
          warnings.push(...stepWarnings)
          continue
        }
      }

      const defaults =
        step.collection === 'platformContentMedia' && platformSeedActorId != null
          ? { createdBy: platformSeedActorId }
          : undefined

      const result = await importCollection({
        payload,
        kind: 'baseline',
        collection: step.collection,
        fileName: step.fileName,
        mapping: step.mapping,
        defaults,
        resolvers,
        req,
      })
      const { name: _ignoredName, ...rest } = result
      units.push({ name: step.name, ...rest })
      warnings.push(...result.warnings)
      failures.push(...result.failures)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`Baseline seed ${step.name} failed: ${message}`)
    }
  }

  return { units, warnings, failures }
}
