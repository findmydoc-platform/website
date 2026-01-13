import type { CollectionSlug, Payload } from 'payload'
import type { SeedKind, SeedRecord } from './load-json'
import type { StableIdResolvers } from './resolvers'
import { loadSeedFile } from './load-json'
import { upsertByStableId } from './upsert'

export type RelationMapping = {
  sourceField: string
  targetField: string
  collection: CollectionSlug
  many?: boolean
  required?: boolean
}

export type CollectionImportResult = {
  name: string
  created: number
  updated: number
  warnings: string[]
  failures: string[]
}

function setValueAtPath(target: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split('.')
  let current: Record<string, unknown> = target

  for (let i = 0; i < parts.length; i += 1) {
    const key = parts[i]
    if (!key) continue
    if (i === parts.length - 1) {
      current[key] = value
    } else {
      const next = current[key]
      if (!next || typeof next !== 'object') {
        current[key] = {}
      }
      current = current[key] as Record<string, unknown>
    }
  }
}

function describeRecord(collection: CollectionSlug, record: SeedRecord) {
  return `${collection}:${record.stableId}`
}

export async function importCollection(options: {
  payload: Payload
  kind: SeedKind
  collection: CollectionSlug
  fileName: string
  mapping?: RelationMapping[]
  resolvers: StableIdResolvers
}): Promise<CollectionImportResult> {
  const { payload, kind, collection, fileName, mapping = [], resolvers } = options

  const records = await loadSeedFile(kind, fileName)
  const warnings: string[] = []
  const failures: string[] = []
  let created = 0
  let updated = 0

  for (const record of records) {
    const draft: Record<string, unknown> = { ...record }
    let skip = false

    try {
      for (const relation of mapping) {
        const rawValue = draft[relation.sourceField]
        delete draft[relation.sourceField]

        if (rawValue == null) {
          if (relation.required) {
            warnings.push(`Missing ${relation.sourceField} for ${describeRecord(collection, record)}`)
            skip = true
          }
          continue
        }

        if (relation.many) {
          if (!Array.isArray(rawValue)) {
            warnings.push(`Expected array for ${relation.sourceField} on ${describeRecord(collection, record)}`)
            skip = true
            continue
          }

          const stableIds = rawValue.filter((value) => typeof value === 'string') as string[]
          const { ids, missing } = await resolvers.resolveManyIdsByStableIds(relation.collection, stableIds)

          if (missing.length > 0) {
            warnings.push(
              `Missing ${relation.collection} stableIds for ${describeRecord(collection, record)}: ${missing.join(', ')}`,
            )
            if (relation.required) {
              skip = true
              continue
            }
          }

          setValueAtPath(draft, relation.targetField, ids)
          continue
        }

        if (typeof rawValue !== 'string') {
          warnings.push(`Expected string for ${relation.sourceField} on ${describeRecord(collection, record)}`)
          skip = true
          continue
        }

        const id = await resolvers.resolveIdByStableId(relation.collection, rawValue)
        if (!id) {
          warnings.push(
            `Missing ${relation.collection} for ${describeRecord(collection, record)} (stableId: ${rawValue})`,
          )
          if (relation.required) {
            skip = true
            continue
          }
        } else {
          setValueAtPath(draft, relation.targetField, id)
        }
      }

      if (skip) {
        continue
      }

      const result = await upsertByStableId(payload, collection, draft)
      if (result.created) created += 1
      if (result.updated) updated += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`Failed ${describeRecord(collection, record)}: ${message}`)
    }
  }

  return {
    name: fileName,
    created,
    updated,
    warnings,
    failures,
  }
}
