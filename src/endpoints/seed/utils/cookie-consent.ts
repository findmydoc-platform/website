import type { Payload } from 'payload'

import { ensureManagedLegalContent } from '@/collections/Pages/legalPages'
import { normalizeCookieConsentCategories, toCookieConsentCategorySettings } from '@/features/cookieConsent/categories'
import { isManagedLegalPageSlug } from '@/utilities/legalPages'

type CookieConsentSeedData = Record<string, unknown> & {
  privacyPolicyPage?: unknown
  privacyPolicyUrl?: unknown
  optionalCategorySettings?: unknown
  optionalCategories?: unknown
}

function normalizeManagedLegalPageSlug(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const slug = value.trim().replace(/^\/+/, '')
  return isManagedLegalPageSlug(slug) ? slug : null
}

async function resolveManagedLegalPageId(payload: Payload, value: unknown): Promise<string | number> {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return Number(value.trim())
  }

  if (value && typeof value === 'object') {
    const record = value as { id?: unknown; slug?: unknown }

    if (typeof record.id === 'number' && Number.isFinite(record.id)) {
      return record.id
    }

    if (typeof record.id === 'string' && /^\d+$/.test(record.id.trim())) {
      return Number(record.id.trim())
    }

    const objectSlug = normalizeManagedLegalPageSlug(record.slug)
    if (objectSlug) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const result = await payload.find({
          collection: 'pages',
          where: {
            slug: {
              equals: objectSlug,
            },
          },
          limit: 1,
          pagination: false,
          overrideAccess: true,
          depth: 0,
        })

        const pageId = result.docs[0]?.id
        if (typeof pageId === 'number' || typeof pageId === 'string') {
          return pageId
        }

        await ensureManagedLegalContent(payload)
      }
    }
  }

  const slug = normalizeManagedLegalPageSlug(value)
  if (slug) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const result = await payload.find({
        collection: 'pages',
        where: {
          slug: {
            equals: slug,
          },
        },
        limit: 1,
        pagination: false,
        overrideAccess: true,
        depth: 0,
      })

      const pageId = result.docs[0]?.id
      if (typeof pageId === 'number' || typeof pageId === 'string') {
        return pageId
      }

      await ensureManagedLegalContent(payload)
    }
  }

  throw new Error('Cookie consent seed requires a privacy policy page that matches a managed legal page slug.')
}

export async function prepareCookieConsentSeedData(
  payload: Payload,
  data: CookieConsentSeedData,
): Promise<CookieConsentSeedData> {
  const next: CookieConsentSeedData = { ...data }
  const categorySource = next.optionalCategorySettings ?? next.optionalCategories
  const source = next.privacyPolicyPage ?? next.privacyPolicyUrl

  if (source === undefined || source === null) {
    throw new Error('Cookie consent seed is missing a privacy policy page reference.')
  }

  if (categorySource !== undefined) {
    next.optionalCategorySettings = toCookieConsentCategorySettings(normalizeCookieConsentCategories(categorySource))
  }

  next.privacyPolicyPage = await resolveManagedLegalPageId(payload, source)
  delete next.optionalCategories
  delete next.privacyPolicyUrl

  return next
}
