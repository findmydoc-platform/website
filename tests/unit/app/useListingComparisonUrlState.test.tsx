// @vitest-environment jsdom
import * as React from 'react'
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ListingComparisonQueryState } from '@/utilities/listingComparison/queryState'
import { useListingComparisonUrlState } from '@/app/(frontend)/listing-comparison/useListingComparisonUrlState'

const pushMock = vi.fn()
const replaceMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => '/listing-comparison',
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}))

type HookApi = ReturnType<typeof useListingComparisonUrlState>

function HookHarness({
  queryState,
  onState,
}: {
  queryState: ListingComparisonQueryState
  onState: (state: HookApi) => void
}) {
  const state = useListingComparisonUrlState({
    queryState,
    priceBounds: { min: 0, max: 20000 },
  })

  React.useEffect(() => {
    onState(state)
  }, [onState, state])

  return null
}

function getQueryParamsFromHref(href: string): URLSearchParams {
  const [, rawQuery = ''] = href.split('?')
  return new URLSearchParams(rawQuery)
}

describe('useListingComparisonUrlState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    pushMock.mockReset()
    replaceMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('serializes specialty as a single value in query updates', () => {
    let latestState: HookApi | null = null

    render(
      <HookHarness
        queryState={{
          page: 1,
          sort: 'rank',
          cities: [],
          treatments: [],
          specialties: ['1'],
          ratingMin: null,
          priceMin: 0,
          priceMax: 20000,
        }}
        onState={(state) => {
          latestState = state
        }}
      />,
    )

    act(() => {
      latestState?.setFilterDraft((current) => ({
        ...current,
        specialty: '2',
      }))
    })

    act(() => {
      vi.advanceTimersByTime(250)
    })

    const href = replaceMock.mock.calls.at(-1)?.[0]
    expect(typeof href).toBe('string')

    const params = getQueryParamsFromHref(href as string)
    expect(params.get('specialty')).toBe('2')
    expect(params.get('specialty')).not.toContain(',')
  })

  it('clearSpecialtySelection removes both specialty and treatment from URL state', () => {
    let latestState: HookApi | null = null

    render(
      <HookHarness
        queryState={{
          page: 1,
          sort: 'rank',
          cities: [],
          treatments: ['101'],
          specialties: ['2'],
          ratingMin: null,
          priceMin: 0,
          priceMax: 20000,
        }}
        onState={(state) => {
          latestState = state
        }}
      />,
    )

    act(() => {
      latestState?.clearSpecialtySelection()
    })

    const href = replaceMock.mock.calls.at(-1)?.[0]
    expect(href).toBe('/listing-comparison')
  })

  it('normalizes multi-specialty query state to a single specialty in URL', () => {
    render(
      <HookHarness
        queryState={{
          page: 1,
          sort: 'rank',
          cities: [],
          treatments: [],
          specialties: ['2', '3'],
          ratingMin: null,
          priceMin: 0,
          priceMax: 20000,
        }}
        onState={() => {
          return undefined
        }}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(250)
    })

    const href = replaceMock.mock.calls.at(-1)?.[0]
    expect(typeof href).toBe('string')

    const params = getQueryParamsFromHref(href as string)
    expect(params.get('specialty')).toBe('2')
    expect(params.get('specialty')).not.toContain(',')
  })
})
