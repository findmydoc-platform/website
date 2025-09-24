import path from 'path'

type RelationInput = string | number | { id?: string | number; value?: string | number } | null | undefined

type ResolveDocArgs = {
  operation: 'create' | 'update'
  data?: Record<string, unknown>
  originalDoc?: Record<string, unknown>
  req?: Record<string, unknown>
}

const posix = path.posix

const SLASH_REGEX = /[\\/]/g

export function extractRelationId(value: RelationInput): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string' || typeof value === 'number') {
    const str = String(value).trim()
    return str.length ? str : null
  }

  if (typeof value === 'object') {
    const candidate = (value as any).id ?? (value as any).value
    if (candidate === null || candidate === undefined) return null
    const str = String(candidate).trim()
    return str.length ? str : null
  }

  return null
}

export function resolveDocumentId({ operation, data, originalDoc, req }: ResolveDocArgs): string | null {
  const candidates: Array<unknown> = []

  if (data) {
    candidates.push((data as any).id, (data as any).docId)
  }

  if (originalDoc) {
    candidates.push((originalDoc as any).id)
  }

  if (req) {
    candidates.push((req as any).id, (req as any).docId, (req as any).context?.id)
  }

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue
    const str = String(candidate).trim()
    if (str.length) return str
  }

  if (operation === 'update') {
    return null
  }

  return null
}

export function sanitizePathSegment(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  if (!str.length) return null
  return str.replace(SLASH_REGEX, '_')
}

export function getBaseFilename(filename?: string | null): string | null {
  if (!filename) return null
  const trimmed = filename.replace(/^\/+/, '')
  const base = posix.basename(trimmed)
  if (!base.length) return null
  return base.replace(SLASH_REGEX, '_')
}

export function buildNestedFilename(
  ownerSegment: string | null,
  documentId: string,
  baseFilename: string,
): string {
  if (ownerSegment && ownerSegment.length) {
    return `${ownerSegment}/${documentId}/${baseFilename}`
  }

  return `${documentId}/${baseFilename}`
}

export function buildStoragePath(
  prefix: string,
  ownerSegment: string | null,
  documentId: string,
  baseFilename: string,
): string {
  if (ownerSegment && ownerSegment.length) {
    return `${prefix}/${ownerSegment}/${documentId}/${baseFilename}`
  }

  return `${prefix}/${documentId}/${baseFilename}`
}
