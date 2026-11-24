import type { Payload } from 'payload'

import configPromise from '@payload-config'
import { getPayload } from 'payload'

import type { Page, Post, Redirect } from '@/payload-types'
import { buildPagePath, buildPostPath } from '@/utilities/cachePolicy'
import {
  buildCmsRedirectPath,
  type CmsRedirectCollection,
  type CmsRedirectSource,
} from '@/utilities/content/cmsRedirectPaths'
import { isReservedPageSlug, type ContentLocale } from '@/utilities/contentLocalization'
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
  sourcePath: string,
): Promise<string | null> {
  const collection = normalizeSupportedCollection(reference?.relationTo)
  const id = normalizeReferenceId(reference?.value)

  if (!collection || id === null) return null

  const payload = await getPayload({ config: configPromise })

  const locale = sourcePath === '/en' || sourcePath.startsWith('/en/') ? 'en' : 'de'
  const targetPath = await resolveRedirectTargetPathById({ collection, id, locale, payload })
  if (targetPath || locale !== 'de') return targetPath

  return resolveRedirectTargetPathById({ collection, id, locale: 'en', payload })
}

export async function findPublicCmsCanonicalBySlug({ collection, locale, slug }: CmsRedirectSource) {
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({
    collection,
    locale,
    draft: false,
    fallbackLocale: false,
    overrideAccess: false,
    depth: 0,
    limit: 1,
    pagination: false,
    select: { slug: true },
    where: { and: [{ slug: { equals: slug } }, { _status: { equals: 'published' } }] },
  })
  const doc = result.docs[0]
  const path = doc?.slug && buildCmsRedirectPath(collection, locale, doc.slug)
  return path ? { id: doc.id, path } : null
}

export async function resolveSameLocaleRedirectTargetPath(
  reference: RedirectTargetReference,
  collection: CmsRedirectCollection,
  locale: ContentLocale,
): Promise<string | null> {
  const id = normalizeReferenceId(reference.value)
  if (reference.relationTo !== collection || id === null) return null

  const payload = await getPayload({ config: configPromise })
  return resolveRedirectTargetPathById({ collection, id, locale, payload, sameLocale: true })
}

async function resolveRedirectTargetPathById({
  collection,
  id,
  locale,
  payload,
  sameLocale = false,
}: {
  collection: SupportedRedirectTargetCollection
  id: string | number
  locale: ContentLocale
  payload: Payload
  sameLocale?: boolean
}): Promise<string | null> {
  let target: RedirectTargetDocument | null

  try {
    target = (await payload.findByID({
      collection,
      id,
      depth: 0,
      draft: false,
      overrideAccess: false,
      locale,
      fallbackLocale: false,
      select: PUBLIC_TARGET_SELECT,
    })) as RedirectTargetDocument | null
  } catch {
    return null
  }

  if (!target || target._status !== 'published' || target.deletedAt) return null

  const slug = typeof target.slug === 'string' ? target.slug.trim() : ''
  if (!slug) return null
  if (sameLocale) return buildCmsRedirectPath(collection, locale, slug)
  if (collection === 'pages' && isReservedPageSlug(slug, locale)) return null

  let targetPath: string

  try {
    targetPath = collection === 'pages' ? buildPagePath(slug, locale) : buildPostPath(slug, locale)
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
