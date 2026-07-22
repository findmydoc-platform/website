import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PageRange } from '@/components/molecules/PageRange'
import { PriceSummary } from '@/components/molecules/PriceSummary'
import { RatingSummary } from '@/components/molecules/RatingSummary'

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

  it('renders PageRange from page 1 when currentPage is missing', () => {
    const markup = renderToStaticMarkup(
      React.createElement(PageRange, {
        limit: 12,
        totalDocs: 24,
      }),
    )

    expect(markup).toContain('Showing 1 - 12 of 24 Docs')
  })
})
