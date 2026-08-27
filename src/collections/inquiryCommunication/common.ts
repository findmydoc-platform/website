import type { CollectionBeforeChangeHook, Field } from 'payload'

const normalize = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, normalize(nested)]),
    )
  }
  return value
}

export const immutableInquiryFields = (fields: readonly string[]): CollectionBeforeChangeHook => {
  return ({ data, operation, originalDoc, req }) => {
    if (operation !== 'update' || !data || !originalDoc) return data
    if (req.context?.inquiryRetentionScrub === true) return data

    for (const field of fields) {
      if (!Object.prototype.hasOwnProperty.call(data, field)) continue
      if (JSON.stringify(normalize(data[field])) === JSON.stringify(normalize(originalDoc[field]))) continue
      throw new Error(`${field} cannot be changed after creation.`)
    }

    return data
  }
}

export const hiddenSystemTextField = (name: string, options?: { index?: boolean; required?: boolean }): Field => ({
  name,
  type: 'text',
  required: options?.required ?? true,
  index: options?.index,
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
  },
  admin: {
    hidden: true,
    readOnly: true,
  },
})
