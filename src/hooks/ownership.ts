/**
 * Extracts a string identifier from a variety of relation-like inputs.
 * Accepts primitives (string/number) or objects with `id`/`value` fields.
 * Returns a trimmed string identifier or null when not resolvable.
 */
function defaultExtractId(value: any): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') {
    const s = String(value).trim()
    return s.length ? s : null
  }
  if (typeof value === 'object') {
    const candidate = (value as any).id ?? (value as any).value
    if (candidate == null) return null
    const s = String(candidate).trim()
    return s.length ? s : null
  }
  return null
}

export function assertFrozenRelationOnUpdate(opts: {
  operation: 'create' | 'update'
  draft: any
  originalDoc?: any
  relationField: string
  extractId?: (v: any) => string | null
  message?: string
}) {
  const { operation, draft, originalDoc, relationField, extractId = defaultExtractId } = opts
  if (operation !== 'update' || !originalDoc) return

  const incoming = extractId(draft?.[relationField])
  const existing = extractId(originalDoc?.[relationField])
  if (incoming && existing && incoming !== existing) {
    throw new Error(opts.message ?? `${relationField} cannot be changed once set`)
  }
}

/**
 * Reusable beforeChange hook that freezes a relation field after creation.
 * Use per collection by configuring the `relationField` and optional error message.
 */
export function beforeChangeFreezeRelation({
  relationField,
  message,
  extractId,
}: {
  relationField: string
  message?: string
  extractId?: (v: any) => string | null
}) {
  return async ({ data, originalDoc, operation }: { data: any; originalDoc?: any; operation: 'create' | 'update' }) => {
    const draft: any = { ...(data || {}) }
    const incoming = (extractId ?? defaultExtractId)(draft?.[relationField])
    const existing = (extractId ?? defaultExtractId)(originalDoc?.[relationField])
    if (operation === 'update' && originalDoc && incoming && existing && incoming !== existing) {
      throw new Error(message ?? `${relationField} cannot be changed once set`)
    }
    return draft
  }
}
