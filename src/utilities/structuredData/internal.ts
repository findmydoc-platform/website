import { getAbsoluteSiteURL } from '@/utilities/socialPreview'

import type { JsonLdNode, JsonLdObject, JsonLdValue } from './types'

const isJsonLdObject = (value: JsonLdValue): value is JsonLdObject =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const cleanJsonLdValue = (value: JsonLdValue): JsonLdValue => {
  if (value === null || value === undefined || value === '') return undefined

  if (Array.isArray(value)) {
    const nextValue = value.map(cleanJsonLdValue).filter((item) => item !== undefined && item !== null && item !== '')
    return nextValue.length > 0 ? nextValue : undefined
  }

  if (isJsonLdObject(value)) {
    const entries = Object.entries(value)
      .map(([key, entryValue]) => [key, cleanJsonLdValue(entryValue)] as const)
      .filter(([, entryValue]) => entryValue !== undefined && entryValue !== null && entryValue !== '')

    return entries.length > 0 ? Object.fromEntries(entries) : undefined
  }

  return value
}

export const cleanJsonLdNode = (node: JsonLdNode | null | undefined): JsonLdNode | null => {
  const cleaned = cleanJsonLdValue(node)
  return isJsonLdObject(cleaned) ? cleaned : null
}

export const cleanJsonLdNodes = (nodes: Array<JsonLdNode | null | undefined>): JsonLdNode[] =>
  nodes.map(cleanJsonLdNode).filter((node): node is JsonLdNode => Boolean(node))

export const absoluteUrl = (pathOrURL: string) => getAbsoluteSiteURL(pathOrURL)

export const buildNodeId = (pathOrURL: string, fragment: string) => `${absoluteUrl(pathOrURL)}#${fragment}`

export const organizationId = () => buildNodeId('/', 'organization')

export const websiteId = () => buildNodeId('/', 'website')
