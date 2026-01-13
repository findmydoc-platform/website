import type { CollectionSlug } from 'payload'
import type { RelationMapping } from './import-collection'
import type { StableIdResolvers } from './resolvers'

export type TransformResult = {
  records: Record<string, unknown>[]
  warnings: string[]
}

export async function transformExportToSeed(options: {
  collection: CollectionSlug
  records: Record<string, unknown>[]
  mapping?: RelationMapping[]
  resolvers: StableIdResolvers
}): Promise<TransformResult> {
  const { collection, records, mapping = [], resolvers } = options
  const warnings: string[] = []

  const transformed = await Promise.all(
    records.map(async (record) => {
      const output: Record<string, unknown> = { ...record }

      for (const relation of mapping) {
        const value = output[relation.sourceField]
        delete output[relation.sourceField]

        if (value == null) {
          continue
        }

        if (relation.many) {
          if (!Array.isArray(value)) {
            warnings.push(`Expected array for ${relation.sourceField} on ${collection}`)
            continue
          }

          const ids = value.filter((item) => typeof item === 'string' || typeof item === 'number') as Array<
            string | number
          >
          const { stableIds, missing } = await resolvers.resolveManyStableIdsByIds(relation.collection, ids)

          if (missing.length > 0) {
            warnings.push(
              `Missing stableIds for ${relation.collection} in ${collection}: ${missing.join(', ')}`,
            )
          }

          output[relation.targetField] = stableIds
          continue
        }

        if (typeof value !== 'string' && typeof value !== 'number') {
          warnings.push(`Expected id for ${relation.sourceField} on ${collection}`)
          continue
        }

        const stableId = await resolvers.resolveStableIdById(relation.collection, value)
        if (!stableId) {
          warnings.push(`Missing stableId for ${relation.collection} in ${collection}: ${value}`)
          continue
        }

        output[relation.targetField] = stableId
      }

      return output
    }),
  )

  return { records: transformed, warnings }
}
