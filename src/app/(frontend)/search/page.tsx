import type { Metadata } from 'next/types'

import Link from 'next/link'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import { SearchBlock } from '@/blocks/SearchBlock/Component'
import { buildSearchWhere, type SearchFilters } from '@/utilities/buildSearchWhere'

type SearchResultDoc = {
  id: string
  title?: string | null
  slug?: string | null
  meta?: {
    description?: string | null
  } | null
  doc?: {
    relationTo?: string | null
    value?: {
      id?: string
      slug?: string | null
    } | null
  } | null
  city?:
    | {
        name?: string | null
      }
    | string
    | null
  country?: string | null
  minPrice?: number | null
  maxPrice?: number | null
}

/**
 * Renders the clinic search experience backed by Payload's search index.
 */
export default async function Page({ searchParams: searchParamsPromise }: { searchParams?: Promise<SearchFilters> }) {
  const searchParamsResolved = await searchParamsPromise
  const payload = await getPayload({ config: configPromise })

  const filters: SearchFilters = {
    service: searchParamsResolved?.service,
    location: searchParamsResolved?.location,
    budget: searchParamsResolved?.budget,
    q: searchParamsResolved?.q,
  }

  const where = await buildSearchWhere({ payload, filters })

  const searchResponse = await payload.find({
    collection: 'search',
    depth: 2,
    limit: 24,
    overrideAccess: true,
    pagination: false,
    // `buildSearchWhere` returns a plain object for flexibility; cast to `any` so Payload types are satisfied.
    where: where as any,
  })

  // Payload's Search.id may be number or string depending on adapter; accept both.
  type LooseSearchResult = SearchResultDoc & { id: string | number }
  const results = (searchResponse.docs as unknown as LooseSearchResult[]).map((r) => ({
    ...r,
    id: String(r.id),
  })) as SearchResultDoc[]

  const formatLocation = (result: SearchResultDoc): string => {
    const cityValue = result.city

    const cityName =
      typeof cityValue === 'string'
        ? cityValue
        : cityValue && typeof cityValue === 'object' && 'name' in cityValue
          ? (cityValue.name ?? undefined)
          : undefined

    return [cityName, result.country].filter(Boolean).join(', ')
  }

  const formatPriceRange = (minPrice?: number | null, maxPrice?: number | null): string => {
    const hasMin = typeof minPrice === 'number' && !Number.isNaN(minPrice)
    const hasMax = typeof maxPrice === 'number' && !Number.isNaN(maxPrice)

    if (!hasMin && !hasMax) return ''

    if (hasMin && hasMax) {
      return `${minPrice!.toLocaleString()} – ${maxPrice!.toLocaleString()} USD`
    }

    if (hasMin) {
      return `From ${minPrice!.toLocaleString()} USD`
    }

    if (hasMax) {
      return `Up to ${maxPrice!.toLocaleString()} USD`
    }

    return ''
  }

  const hasFiltersApplied = Boolean(filters.service || filters.location || filters.budget || filters.q)

  return (
    <div className="pb-24 pt-24">
      <div className="container mb-12">
        <div className="mx-auto max-w-3xl space-y-8 text-center">
          <div className="space-y-4">
            <h1 className="text-3xl font-semibold">Find a clinic</h1>
            <p className="text-muted-foreground">
              Search across clinics, treatments, and doctors indexed by findmydoc.
            </p>
          </div>
          <SearchBlock title="Search clinics and treatments" />
        </div>
      </div>

      <div className="container space-y-6">
        {hasFiltersApplied ? (
          <p className="text-sm text-muted-foreground">
            Showing results for
            {filters.service ? ` treatment "${filters.service}"` : ''}
            {filters.location ? ` in ${filters.location}` : ''}
            {filters.budget ? ` within ${filters.budget} USD` : ''}
            {!filters.service && !filters.location && !filters.budget && filters.q ? ` "${filters.q}"` : ''}.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Browse featured clinics below.</p>
        )}

        {results.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {/* TEMPORARY: replace with dedicated SearchResults organism once implementation stabilises. */}
            {results.map((result) => {
              const locationLabel = formatLocation(result)
              const priceLabel = formatPriceRange(result.minPrice, result.maxPrice)
              const clinicSlug = result.slug || result.doc?.value?.slug || null
              const detailHref = clinicSlug ? `/clinic/${clinicSlug}` : null

              return (
                <article key={result.id} className="rounded-2xl border border-border bg-white p-6 shadow-sm">
                  <div className="space-y-3">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">{result.title ?? 'Clinic'}</h2>
                      {locationLabel && <p className="text-sm text-muted-foreground">{locationLabel}</p>}
                    </div>
                    {result.meta?.description && (
                      <p className="line-clamp-4 text-sm text-muted-foreground">{result.meta.description}</p>
                    )}
                    {(priceLabel || detailHref) && (
                      <div className="flex items-center justify-between text-sm text-foreground">
                        <span>{priceLabel}</span>
                        {detailHref && (
                          <Link href={detailHref} className="text-primary underline-offset-2 hover:underline">
                            View clinic
                          </Link>
                        )}
                      </div>
                    )}
                  </div>
                </article>
              )
            })}
            {/* TEMPORARY END */}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/20 p-10 text-center text-muted-foreground">
            No clinics match the selected filters yet.
          </div>
        )}
      </div>
    </div>
  )
}

export function generateMetadata(): Metadata {
  return {
    title: 'findmydoc Search',
  }
}
