import {
  assertKnownDiscoveryId,
  assertKnownGlobal,
  assertKnownSitemapId,
  assertTaggableCollection,
  assertTaggableSurfaceId,
  PARAMETERIZED_SURFACE_IDS,
  type ParameterizedSurfaceId,
} from '@/utilities/cachePolicy'

import type { RevalidationPlan } from './types'

export class InvalidRevalidationPlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidRevalidationPlanError'
  }
}

const CONTROL_CHARACTERS_PATTERN = /[\u0000-\u001F\u007F]/
const WHITESPACE_PATTERN = /\s/
const PRIVATE_PATH_PREFIXES = [
  '/_next',
  '/admin',
  '/api',
  '/auth',
  '/login',
  '/logout',
  '/next',
  '/patient',
  '/payload',
  '/preview',
] as const

const assertExactText = (value: string, label: string): string => {
  if (value !== value.trim() || !value) {
    throw new InvalidRevalidationPlanError(`Invalid ${label}: value must be canonical and non-empty`)
  }

  if (CONTROL_CHARACTERS_PATTERN.test(value) || WHITESPACE_PATTERN.test(value)) {
    throw new InvalidRevalidationPlanError(`Invalid ${label}: value must not contain whitespace or control characters`)
  }

  return value
}

const assertTagSegment = (value: string, label: string): string => {
  const segment = assertExactText(value, label)

  if (segment.includes(':')) {
    throw new InvalidRevalidationPlanError(`Invalid ${label}: value must not contain ":"`)
  }

  return segment
}

const assertSurfaceInstanceTag = (surfaceId: string, id: string): void => {
  const normalizedSurfaceId = assertTaggableSurfaceId(surfaceId)

  if (!PARAMETERIZED_SURFACE_IDS.includes(normalizedSurfaceId as ParameterizedSurfaceId)) {
    throw new InvalidRevalidationPlanError(`Invalid cache tag: surface is not parameterized: ${surfaceId}`)
  }

  assertTagSegment(id, 'surface instance id')
}

export const normalizeCacheTagIdentifier = (tag: string): string => {
  const normalizedTag = assertExactText(tag, 'cache tag')
  const parts = normalizedTag.split(':')

  switch (parts[0]) {
    case 'entity':
      if (parts.length !== 3) break
      assertTaggableCollection(parts[1] ?? '')
      assertTagSegment(parts[2] ?? '', 'entity id')
      return normalizedTag
    case 'slug':
      if (parts.length !== 3) break
      assertTaggableCollection(parts[1] ?? '')
      assertTagSegment(parts[2] ?? '', 'slug')
      return normalizedTag
    case 'collection':
      if (parts.length !== 2) break
      assertTaggableCollection(parts[1] ?? '')
      return normalizedTag
    case 'global':
      if (parts.length !== 2) break
      assertKnownGlobal(parts[1] ?? '')
      return normalizedTag
    case 'surface':
      if (parts[1] === 'sitemap') {
        if (parts.length !== 3) break
        assertKnownSitemapId(parts[2] ?? '')
        return normalizedTag
      }

      if (parts[1] === 'discovery') {
        if (parts.length !== 3) break
        assertKnownDiscoveryId(parts[2] ?? '')
        return normalizedTag
      }

      if (parts.length === 2) {
        assertTaggableSurfaceId(parts[1] ?? '')
        return normalizedTag
      }

      if (parts.length === 3) {
        assertSurfaceInstanceTag(parts[1] ?? '', parts[2] ?? '')
        return normalizedTag
      }

      break
  }

  throw new InvalidRevalidationPlanError(`Invalid cache tag: ${normalizedTag}`)
}

export const normalizePublicPathIdentifier = (path: string): string => {
  const normalizedPath = assertExactText(path, 'path')

  if (!normalizedPath.startsWith('/')) {
    throw new InvalidRevalidationPlanError(`Invalid path: value must start with "/"`)
  }

  if (normalizedPath.includes('?') || normalizedPath.includes('#') || normalizedPath.includes('//')) {
    throw new InvalidRevalidationPlanError(`Invalid path: value must not include query, hash, or duplicate slash`)
  }

  if (
    normalizedPath === '/..' ||
    normalizedPath.startsWith('/../') ||
    normalizedPath.includes('/../') ||
    normalizedPath.endsWith('/..')
  ) {
    throw new InvalidRevalidationPlanError(`Invalid path: value must not include path traversal`)
  }

  for (const privatePrefix of PRIVATE_PATH_PREFIXES) {
    if (normalizedPath === privatePrefix || normalizedPath.startsWith(`${privatePrefix}/`)) {
      throw new InvalidRevalidationPlanError(`Invalid path: value is not a public cache path`)
    }
  }

  return normalizedPath
}

export const normalizeRevalidationPlanIdentifiers = (plan: RevalidationPlan): RevalidationPlan => {
  const tags = plan.tags.map(normalizeCacheTagIdentifier)
  const paths = plan.paths.map(normalizePublicPathIdentifier)

  return {
    ...plan,
    tags,
    paths,
    logContext: {
      ...plan.logContext,
      tagCount: tags.length,
      pathCount: paths.length,
    },
  }
}
