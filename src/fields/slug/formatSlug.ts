import type { FieldHook, FieldHookArgs } from 'payload'
import { slugify } from '@/utilities/slugify'

export const formatSlug = (val: string): string => slugify(val)

export const formatSlugHook = (
  fieldToSlug: string,
  hookOptions?: { ensureUnique?: boolean },
): FieldHook => {
  return async (args: FieldHookArgs<any, any, any>) => {
    const { value, originalDoc, data, req, operation, collection } = args

    if (operation === 'read') {
      // Returning the original value as no valid base string to slugify was found
      return value
    }

    const slugIsLocked = data?.slugLock ?? originalDoc?.slugLock ?? true
    const sourceFieldHasChanged = originalDoc?.[fieldToSlug] !== data?.[fieldToSlug]
    const isNonEmptyString = typeof value === 'string' && value.trim() !== ''

    let baseStringToSlugify: string | undefined | null = null

    if (slugIsLocked && !sourceFieldHasChanged) {
      baseStringToSlugify = isNonEmptyString ? value : originalDoc?.slug
    } else {
      if (!slugIsLocked && isNonEmptyString) {
        baseStringToSlugify = value
      } else {
        baseStringToSlugify = data?.[fieldToSlug] || originalDoc?.[fieldToSlug]
      }
    }

    if (typeof baseStringToSlugify !== 'string' || baseStringToSlugify.trim() === '') {
      if (hookOptions?.ensureUnique && isNonEmptyString) {
        baseStringToSlugify = value
      } else {
        return value
      }
    }

    const slug = formatSlug(baseStringToSlugify)

    if (hookOptions?.ensureUnique && req?.payload && collection?.slug) {
      const collectionSlug = collection?.slug
      let uniqueSlug = slug
      const MAX_ITERATIONS = 100
      let count = 0
      let slugExists = true

      while (slugExists && count < MAX_ITERATIONS) {
        const querySuffix = count > 0 ? `-${count}` : ''
        const potentialSlug = `${slug}${querySuffix}`

        const query: { slug: { equals: string }; id?: { not_equals: string } } = {
          slug: { equals: potentialSlug },
        }

        if (operation === 'update' && originalDoc?.id) {
          query.id = { not_equals: originalDoc.id }
        }

        try {
          const existingDoc = await req.payload.find({
            collection: collectionSlug,
            where: query,
            limit: 1,
            depth: 0,
            overrideAccess: false,
            user: undefined,
          })

          if (existingDoc.docs.length === 0) {
            uniqueSlug = potentialSlug
            slugExists = false
          } else {
            count++
          }
        } catch (error) {
          console.error(
            `Error checking for existing slug in collection '${collectionSlug}':`,
            error,
          )
          slugExists = false
          uniqueSlug = slug
        }
      }
      return uniqueSlug
    }

    return slug
  }
}
