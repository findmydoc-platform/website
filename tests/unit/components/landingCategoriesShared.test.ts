import { describe, expect, it } from 'vitest'

import { withSpecialtyQuery } from '@/components/organisms/Landing/LandingCategories.shared'

describe('withSpecialtyQuery', () => {
  it('does not rewrite protocol-relative external links', () => {
    const href = withSpecialtyQuery('//findmydoc.eu/listing-comparison#overview', 'nose')

    expect(href).toBe('//findmydoc.eu/listing-comparison#overview')
  })

  it('keeps full hash fragments when a specialty is added', () => {
    const href = withSpecialtyQuery('/listing-comparison#overview#details', 'nose')

    expect(href).toBe('/listing-comparison?specialty=nose#overview#details')
  })

  it('keeps full hash fragments when a specialty is removed', () => {
    const href = withSpecialtyQuery('/listing-comparison?specialty=eyes#overview#details', null)

    expect(href).toBe('/listing-comparison#overview#details')
  })
})
