import type { CollectionSlug, Payload } from 'payload'
import fs from 'fs'
import path from 'path'
import { CONTENT_LOCALES, DEFAULT_CONTENT_LOCALE, type ContentLocale } from '@/utilities/contentLocalization'
import type { SeedKind, SeedRecord } from './load-json'
import type { StableIdResolvers } from './resolvers'
import { loadSeedFile } from './load-json'
import { upsertByStableId } from './upsert'

export type RelationMapping = {
  sourceField: string
  targetField: string
  collection: CollectionSlug
  resolver?: 'stableId'
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

type LocalizedSeedUpdates = Partial<Record<ContentLocale, Record<string, unknown>>>

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

function getValueAtPath(target: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = target

  for (const key of parts) {
    if (!key) continue
    if (!current || typeof current !== 'object') {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }

  return current
}

function isLocalizedSeedValue(value: unknown): value is Partial<Record<ContentLocale, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return CONTENT_LOCALES.some((locale) => Object.prototype.hasOwnProperty.call(value, locale))
}

function extractLocalizedFieldUpdates(draft: Record<string, unknown>, localizedFields: string[]): LocalizedSeedUpdates {
  const updates: LocalizedSeedUpdates = {}

  for (const fieldPath of localizedFields) {
    const localizedValue = getValueAtPath(draft, fieldPath)
    if (!isLocalizedSeedValue(localizedValue)) {
      continue
    }

    const defaultValue = localizedValue[DEFAULT_CONTENT_LOCALE]
    if (typeof defaultValue !== 'undefined') {
      setValueAtPath(draft, fieldPath, defaultValue)
    }

    for (const locale of CONTENT_LOCALES) {
      if (locale === DEFAULT_CONTENT_LOCALE) continue

      const localeValue = localizedValue[locale]
      if (typeof localeValue === 'undefined') continue

      const localeUpdate = updates[locale] ?? {}
      setValueAtPath(localeUpdate, fieldPath, localeValue)
      updates[locale] = localeUpdate
    }
  }

  return updates
}

async function applyLocalizedFieldUpdates(options: {
  payload: Payload
  collection: CollectionSlug
  docId: string | number
  updates: LocalizedSeedUpdates
  context?: Record<string, unknown>
  req?: Partial<import('payload').PayloadRequest>
}) {
  const { payload, collection, docId, updates, context, req } = options

  for (const locale of CONTENT_LOCALES) {
    if (locale === DEFAULT_CONTENT_LOCALE) continue

    const data = updates[locale]
    if (!data || Object.keys(data).length === 0) continue

    await payload.update({
      collection,
      id: docId,
      locale,
      data,
      trash: true,
      overrideAccess: true,
      context: {
        disableRevalidate: true,
        disableSearchSync: true,
        ...(context ?? {}),
      },
      req,
    })
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
  defaults?: Record<string, unknown>
  resolvers: StableIdResolvers
  context?: Record<string, unknown>
  req?: Partial<import('payload').PayloadRequest>
  stableIds?: string[]
  localizedFields?: string[]
}): Promise<CollectionImportResult> {
  const {
    payload,
    kind,
    collection,
    fileName,
    mapping = [],
    defaults,
    resolvers,
    context,
    req,
    stableIds,
    localizedFields = [],
  } = options

  const allRecords = await loadSeedFile(kind, fileName)
  const records =
    Array.isArray(stableIds) && stableIds.length > 0
      ? allRecords.filter((record) => stableIds.includes(record.stableId))
      : allRecords
  const warnings: string[] = []
  const failures: string[] = []
  let created = 0
  let updated = 0

  for (const record of records) {
    const draft: Record<string, unknown> = { ...(defaults ?? {}), ...record }
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

        const resolvedId = await resolvers.resolveIdByStableId(relation.collection, rawValue)

        if (!resolvedId) {
          warnings.push(
            `Missing ${relation.collection} for ${formatRecordIdentifier(collection, record)} (stableId: ${rawValue})`,
          )
          if (relation.required) {
            skip = true
            continue
          }
        } else {
          setValueAtPath(draft, relation.targetField, resolvedId)
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

      const localizedUpdates = extractLocalizedFieldUpdates(draft, localizedFields)

      const result = await upsertByStableId(payload, collection, draft, {
        filePath,
        context,
        req,
      })
      if (result.created) created += 1
      if (result.updated) updated += 1

      if (Object.keys(localizedUpdates).length > 0) {
        const docId = await resolvers.resolveIdByStableId(collection, record.stableId)
        if (!docId) {
          warnings.push(`Missing ${collection} stableId for localized update: ${record.stableId}`)
          continue
        }

        await applyLocalizedFieldUpdates({
          payload,
          collection,
          docId,
          updates: localizedUpdates,
          context,
          req,
        })
      }
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
