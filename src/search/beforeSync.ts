import { BeforeSync, DocToSync } from '@payloadcms/plugin-search/types'

/**
 * Returns a serialized representation of rich text for search indexing.
 */
const extractRichText = (value: unknown): string => {
  if (!value) return ''

  if (typeof value === 'string') {
    return value
  }

  try {
    const serialized = JSON.stringify(value)
    return serialized.length > 400 ? `${serialized.substring(0, 400)}…` : serialized
  } catch (_error) {
    return ''
  }
}

/**
 * Normalizes collection documents before syncing them to the search index.
 */
export const beforeSyncWithSearch: BeforeSync = async ({ originalDoc, searchDoc }) => {
  const {
    doc: { relationTo: collection },
  } = searchDoc

  const modifiedDoc: DocToSync & {
    city?: unknown
    country?: unknown
    clinic?: unknown
    minPrice?: number
    maxPrice?: number
    treatmentName?: string
  } = {
    ...searchDoc,
    slug: originalDoc.slug,
    meta: {},
    categories: [],
  }

  switch (collection) {
    case 'posts': {
      modifiedDoc.title = originalDoc.title
      const metaTitle = originalDoc.meta?.title || originalDoc.title
      modifiedDoc.meta = {
        title: metaTitle,
        description: originalDoc.meta?.description,
        image: originalDoc.meta?.image?.id || originalDoc.meta?.image,
      }

      if (Array.isArray(originalDoc.categories)) {
        modifiedDoc.categories = originalDoc.categories.map((category: Record<string, unknown>) => ({
          relationTo: 'categories',
          id: category?.id,
          title: category?.title,
        }))
      }

      break
    }

    case 'clinics': {
      modifiedDoc.title = originalDoc.name
      modifiedDoc.meta = {
        title: originalDoc.name,
        description: extractRichText(originalDoc.description),
      }

      modifiedDoc.city = originalDoc.address?.city
      modifiedDoc.country = originalDoc.address?.country

      if (Array.isArray(originalDoc.treatments) && originalDoc.treatments.length > 0) {
        const prices = originalDoc.treatments
          .map((entry: Record<string, unknown>) => {
            if (entry?.price && typeof entry.price === 'number') {
              return entry.price
            }

            if (
              entry?.value &&
              typeof entry.value === 'object' &&
              'price' in entry.value &&
              typeof (entry.value as { price: unknown }).price === 'number'
            ) {
              return (entry.value as { price: number }).price
            }

            return null
          })
          .filter((price): price is number => price !== null)

        if (prices.length > 0) {
          modifiedDoc.minPrice = Math.min(...prices)
          modifiedDoc.maxPrice = Math.max(...prices)
        }
      }

      break
    }

    case 'treatments': {
      modifiedDoc.title = originalDoc.name
      modifiedDoc.treatmentName = originalDoc.name
      modifiedDoc.meta = {
        title: originalDoc.name,
        description: extractRichText(originalDoc.description),
      }
      break
    }

    case 'doctors': {
      const titlePrefix = originalDoc.title ? `${originalDoc.title} ` : ''
      const fullName = `${titlePrefix}${originalDoc.firstName ?? ''} ${originalDoc.lastName ?? ''}`.trim()

      modifiedDoc.title = fullName
      modifiedDoc.meta = {
        title: fullName || originalDoc.fullName,
        description: extractRichText(originalDoc.bio),
      }

      modifiedDoc.clinic = originalDoc.clinic
      break
    }

    default: {
      modifiedDoc.title = originalDoc.title || originalDoc.name
      modifiedDoc.meta = {
        title: originalDoc.title || originalDoc.name,
        description: extractRichText(originalDoc.meta?.description),
      }
    }
  }

  return modifiedDoc
}
