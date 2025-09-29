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

interface HasId {
  id?: string | number | null
  docId?: string | number | null
  [key: string]: unknown
}

interface ReqWithContext {
  id?: string | number | null
  docId?: string | number | null
  context?: { id?: string | number | null }
  [key: string]: unknown
}

function getIdCandidates(obj?: HasId | null): Array<string | number | null | undefined> {
  if (!obj) return []
  return [obj.id, obj.docId]
}

function getReqCandidates(req?: ReqWithContext | null): Array<string | number | null | undefined> {
  if (!req) return []
  return [req.id, req.docId, req.context?.id]
}

export function resolveDocumentId({ data, originalDoc, req }: ResolveDocArgs): string | null {
  const candidates: Array<string | number | null | undefined> = [
    ...getIdCandidates(data as HasId),
    ...(originalDoc ? [originalDoc.id as string | number | null | undefined] : []),
    ...getReqCandidates(req as ReqWithContext),
  ]

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue
    const str = String(candidate).trim()
    if (str.length) return str
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

export function buildNestedFilename(ownerSegment: string | null, documentId: string, baseFilename: string): string {
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
