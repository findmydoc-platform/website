import type { Payload } from 'payload'

/**
 * Query string filters accepted by the public search page.
 */
export type SearchFilters = {
  service?: string
  location?: string
  budget?: string
  q?: string
}

/**
 * Arguments required to build the search where clause.
 */
export type BuildSearchWhereArgs = {
  payload: Payload
  filters: SearchFilters
}

/**
 * Builds a Payload where clause for clinic search queries based on request filters.
 */
export const buildSearchWhere = async ({ payload, filters }: BuildSearchWhereArgs): Promise<Record<string, unknown>> => {
  const conditions: Record<string, unknown>[] = []

  const baseCondition: Record<string, unknown> = {
    'doc.relationTo': {
      equals: 'clinics',
    },
  }

  conditions.push(baseCondition)

  const queryTerms = [filters.service, filters.q].filter((term): term is string => Boolean(term && term.trim()))

  queryTerms.forEach((term) => {
    const normalized = term.trim()

    if (normalized.length > 0) {
      conditions.push({
        or: [
          { title: { like: normalized } },
          { treatmentName: { like: normalized } },
          { 'meta.description': { like: normalized } },
          { slug: { like: normalized } },
        ],
      })
    }
  })

  if (filters.location && filters.location.trim().length > 0) {
    try {
      const cities = await payload.find({
        collection: 'cities',
        limit: 1,
        pagination: false,
        overrideAccess: true,
        where: {
          name: {
            equals: filters.location.trim(),
          },
        },
      })

      const resolvedCityId = cities.docs[0]?.id

      if (resolvedCityId) {
        conditions.push({
          city: {
            equals: resolvedCityId,
          },
        })
      }
    } catch (_error) {
      // If city resolution fails we omit the filter and keep remaining conditions.
    }
  }

  if (filters.budget && filters.budget.trim().length > 0) {
    const parsedBudget = Number.parseInt(filters.budget, 10)

    if (Number.isFinite(parsedBudget)) {
      conditions.push({
        or: [
          {
            minPrice: {
              lte: parsedBudget,
            },
          },
          {
            maxPrice: {
              lte: parsedBudget,
            },
          },
        ],
      })
    }
  }

  if (conditions.length === 0) {
    return {}
  }

  if (conditions.length === 1) {
    return conditions[0] ?? {}
  }

  return {
    and: conditions,
  }
}
