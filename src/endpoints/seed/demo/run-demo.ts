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

      const result = await importCollection({
        payload,
        kind: 'demo',
        collection: step.collection,
        fileName: step.fileName,
        mapping: step.mapping,
        resolvers,
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
