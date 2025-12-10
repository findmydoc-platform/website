/**
 * Extracts a string identifier from a variety of relation-like inputs.
 * Accepts primitives (string/number) or objects with `id`/`value` fields.
 * Returns a trimmed string identifier or null when not resolvable.
 */
function defaultExtractId(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string' || typeof value === 'number') {
    const s = String(value).trim()
    return s.length ? s : null
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const candidate = obj.id ?? obj.value
    if (candidate == null) return null
    const s = String(candidate).trim()
    return s.length ? s : null
  }
  return null
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
  extractId?: (v: unknown) => string | null
}) {
  return async ({
    data,
    originalDoc,
    operation,
  }: {
    data: Record<string, unknown>
    originalDoc?: Record<string, unknown>
    operation: 'create' | 'update'
  }) => {
    const draft: Record<string, unknown> = { ...(data || {}) }
    const incoming = (extractId ?? defaultExtractId)(draft?.[relationField])
    const existing = (extractId ?? defaultExtractId)(originalDoc?.[relationField])
    if (operation === 'update' && originalDoc && incoming && existing && incoming !== existing) {
      throw new Error(message ?? `${relationField} cannot be changed once set`)
    }
    return draft
  }
}
