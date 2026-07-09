import type { Payload } from 'payload'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { Page, Post, Redirect } from '@/payload-types'
import { buildPagePath, buildPostPath } from '@/utilities/cachePolicy'
import { sanitizeInternalRedirectPathOrNull } from '@/utilities/routing/sanitizeInternalRedirectPath'

type RedirectReference = NonNullable<NonNullable<Redirect['to']>['reference']>
type SupportedRedirectTargetCollection = 'pages' | 'posts'
type RedirectTargetReference = Pick<RedirectReference, 'relationTo' | 'value'>
type RedirectTargetDocument = Pick<Page | Post, 'slug' | '_status' | 'deletedAt'>

const PUBLIC_TARGET_SELECT = {
  slug: true,
  _status: true,
  deletedAt: true,
} as const

export async function resolveRedirectTargetPath(
  reference: RedirectTargetReference | null | undefined,
): Promise<string | null> {
  const collection = normalizeSupportedCollection(reference?.relationTo)
  const id = normalizeReferenceId(reference?.value)

  if (!collection || id === null) return null

  const payload = await getPayload({ config: configPromise })

  return resolveRedirectTargetPathById({ collection, id, payload })
}

async function resolveRedirectTargetPathById({
  collection,
  id,
  payload,
}: {
  collection: SupportedRedirectTargetCollection
  id: string | number
  payload: Payload
}): Promise<string | null> {
  let target: RedirectTargetDocument | null

  try {
    target = (await payload.findByID({
      collection,
      id,
      depth: 0,
      draft: false,
      overrideAccess: false,
      select: PUBLIC_TARGET_SELECT,
    })) as RedirectTargetDocument | null
  } catch {
    return null
  }

  if (!target || target._status !== 'published' || target.deletedAt) return null

  const slug = typeof target.slug === 'string' ? target.slug.trim() : ''
  if (!slug) return null

  let targetPath: string

  try {
    targetPath = collection === 'pages' ? buildPagePath(slug) : buildPostPath(slug)
  } catch {
    return null
  }

  const safePath = sanitizeInternalRedirectPathOrNull({ nextPath: targetPath })

  if (!safePath) return null
  if (safePath === '/' && !(collection === 'pages' && slug === 'home')) return null

  return safePath
}

function normalizeSupportedCollection(value: unknown): SupportedRedirectTargetCollection | null {
  if (value === 'pages' || value === 'posts') return value

  return null
}

function normalizeReferenceId(value: unknown): string | number | null {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return value

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null

    if (/^\d+$/.test(trimmed)) {
      const numericId = Number(trimmed)
      if (Number.isSafeInteger(numericId) && numericId > 0) return numericId
    }

    return trimmed
  }

  if (isRecord(value) && 'id' in value) {
    return normalizeReferenceId(value.id)
  }

  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
