import type { CollectionSlug, Payload } from 'payload'
import fs from 'fs'
import path from 'path'
import type { SeedKind, SeedRecord } from './load-json'
import type { StableIdResolvers } from './resolvers'
import { loadSeedFile } from './load-json'
import { upsertByStableId } from './upsert'

export type RelationMapping = {
  sourceField: string
  targetField: string
  collection: CollectionSlug
  resolver?: 'stableId' | 'platformStaffByUserStableId'
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
    // Prevent prototype pollution via special property names
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return
    }
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

function formatRecordIdentifier(collection: CollectionSlug, record: SeedRecord) {
  return `${collection}:${record.stableId}`
}

export async function importCollection(options: {
  payload: Payload
  kind: SeedKind
  collection: CollectionSlug
  fileName: string
  mapping?: RelationMapping[]
  resolvers: StableIdResolvers
  context?: Record<string, unknown>
  req?: Partial<import('payload').PayloadRequest>
}): Promise<CollectionImportResult> {
  const { payload, kind, collection, fileName, mapping = [], resolvers, context, req } = options

  const records = await loadSeedFile(kind, fileName)
  const warnings: string[] = []
  const failures: string[] = []
  let created = 0
  let updated = 0

  for (const record of records) {
    const draft: Record<string, unknown> = { ...record }
    let skip = false
    let filePath: string | undefined

    try {
      for (const relation of mapping) {
        const rawValue = draft[relation.sourceField]
        delete draft[relation.sourceField]

        if (rawValue == null) {
          if (relation.required) {
            warnings.push(`Missing ${relation.sourceField} for ${formatRecordIdentifier(collection, record)}`)
            skip = true
          }
          continue
        }

        if (relation.many) {
          if (!Array.isArray(rawValue)) {
            warnings.push(`Expected array for ${relation.sourceField} on ${formatRecordIdentifier(collection, record)}`)
            skip = true
            continue
          }

          const stableIds = rawValue.filter((value) => typeof value === 'string') as string[]
          if (relation.resolver === 'platformStaffByUserStableId') {
            const userResolution = await resolvers.resolveManyIdsByStableIds('basicUsers', stableIds)
            const ids: Array<string | number> = []
            const missing: string[] = [...userResolution.missing]

            for (let i = 0; i < userResolution.ids.length; i += 1) {
              const userId = userResolution.ids[i]
              const sourceStableId = stableIds[i]
              if (!userId) {
                if (sourceStableId) missing.push(sourceStableId)
                continue
              }

              const staff = await payload.find({
                collection: 'platformStaff',
                where: { user: { equals: userId } },
                limit: 1,
                overrideAccess: true,
                req,
              })

              if (staff.docs.length > 0) {
                ids.push(staff.docs[0]!.id)
              } else if (sourceStableId) {
                missing.push(sourceStableId)
              }
            }

            if (missing.length > 0) {
              warnings.push(
                `Missing ${relation.collection} stableIds for ${formatRecordIdentifier(collection, record)}: ${missing.join(', ')}`,
              )
              if (relation.required) {
                skip = true
                continue
              }
            }

            setValueAtPath(draft, relation.targetField, ids)
            continue
          }

          const { ids, missing } = await resolvers.resolveManyIdsByStableIds(relation.collection, stableIds)

          if (missing.length > 0) {
            warnings.push(
              `Missing ${relation.collection} stableIds for ${formatRecordIdentifier(collection, record)}: ${missing.join(', ')}`,
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
          warnings.push(`Expected string for ${relation.sourceField} on ${formatRecordIdentifier(collection, record)}`)
          skip = true
          continue
        }

        const id = await resolvers.resolveIdByStableId(relation.collection, rawValue)
        if (!id) {
          warnings.push(
            `Missing ${relation.collection} for ${formatRecordIdentifier(collection, record)} (stableId: ${rawValue})`,
          )
          if (relation.required) {
            skip = true
            continue
          }
        } else {
          setValueAtPath(draft, relation.targetField, id)
        }
      }

      // Remove any remaining seed-only relation helper fields that were not
      // mapped in this pass (for example, fields handled in a later pass).
      for (const key of Object.keys(draft)) {
        if (key.endsWith('StableId') || key.endsWith('StableIds')) {
          delete draft[key]
        }
      }

      if (typeof draft.filePath === 'string' && draft.filePath.trim().length > 0) {
        const resolvedPath = path.isAbsolute(draft.filePath)
          ? draft.filePath
          : path.resolve(process.cwd(), draft.filePath)
        delete draft.filePath
        if (!fs.existsSync(resolvedPath)) {
          failures.push(`Missing file for ${formatRecordIdentifier(collection, record)}: ${resolvedPath}`)
          skip = true
        } else {
          filePath = resolvedPath
        }
      }

      if (skip) {
        continue
      }

      const result = await upsertByStableId(payload, collection, draft, {
        filePath,
        context,
        req,
      })
      if (result.created) created += 1
      if (result.updated) updated += 1
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      failures.push(`Failed ${formatRecordIdentifier(collection, record)}: ${message}`)
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
