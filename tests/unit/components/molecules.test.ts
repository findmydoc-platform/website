import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { LocationLine } from '@/components/molecules/LocationLine'
import { PageRange } from '@/components/molecules/PageRange'
import { PriceSummary } from '@/components/molecules/PriceSummary'
import { RatingSummary } from '@/components/molecules/RatingSummary'
import { TagList } from '@/components/molecules/TagList'
import { WaitTime } from '@/components/molecules/WaitTime'

describe('summary molecules', () => {
  it('renders PriceSummary with label and formatted currency', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PriceSummary, {
        priceFrom: { label: 'From', value: 7500, currency: 'EUR' },
      }),
    )

    expect(markup).toContain('From')
    expect(markup).toContain('€')
  })

  it('renders RatingSummary with value and count', () => {
    const markup = renderToStaticMarkup(
      React.createElement(RatingSummary, {
        value: 4.5,
        count: 120,
      }),
    )

    expect(markup).toContain('4.5')
    expect(markup).toContain('(120)')
  })

  it('renders WaitTime text', () => {
    const markup = renderToStaticMarkup(React.createElement(WaitTime, { value: '2–3 weeks' }))

    expect(markup).toContain('2–3 weeks')
  })

  it('renders LocationLine text', () => {
    const markup = renderToStaticMarkup(React.createElement(LocationLine, { value: 'Berlin, Mitte' }))

    expect(markup).toContain('Berlin, Mitte')
  })

  it('renders TagList items', () => {
    const tags = ['Orthopedics', 'Rehabilitation']
    const markup = renderToStaticMarkup(React.createElement(TagList, { tags }))

    tags.forEach((tag) => {
      expect(markup).toContain(tag)
    })
  })

  it('defaults PageRange to the first page when currentPage is omitted', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PageRange, {
        totalDocs: 24,
        limit: 12,
      }),
    )

    expect(markup).toContain('Showing 1 - 12 of 24 Docs')
  })
})
