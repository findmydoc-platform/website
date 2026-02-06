import type { Payload } from 'payload'
import { createStableIdResolvers } from '../utils/resolvers'
import { importCollection } from '../utils/import-collection'
import { demoPlan } from '../utils/plan'
import { resetCollections } from '../utils/reset'
import type { SeedRunSummary, SeedUnitSummary } from '../baseline/run-baseline'

export type DemoRunSummary = SeedRunSummary

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

      let req: { user?: unknown } | undefined
      if ('reqUserStableId' in step && step.reqUserStableId) {
        const userId = await resolvers.resolveIdByStableId('basicUsers', step.reqUserStableId)
        if (!userId) {
          warnings.push(`Missing basicUsers for demo seed reqUserStableId: ${step.reqUserStableId}`)
        } else {
          const userDoc = await payload.findByID({
            collection: 'basicUsers',
            id: userId,
            overrideAccess: true,
          })
          req = { user: { ...userDoc, collection: 'basicUsers' } }
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

  return { units, warnings, failures }
}
