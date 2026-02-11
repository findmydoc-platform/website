import { describe, expect, it } from 'vitest'

import {
  buildSpecialtyTree,
  collectDescendantSpecialties,
} from '@/utilities/listingComparison/serverData/specialtyScope'

describe('listingComparison specialty scope', () => {
  it('collects selected specialties including nested descendants', () => {
    const tree = buildSpecialtyTree([
      { id: 1, stableId: 'plastic', name: 'Plastic', slug: 'plastic', parentId: null },
      { id: 2, stableId: 'facial', name: 'Facial', slug: 'facial', parentId: 1 },
      { id: 3, stableId: 'nose', name: 'Nose', slug: 'nose', parentId: 2 },
      { id: 4, stableId: 'dental', name: 'Dental', slug: 'dental', parentId: null },
    ])

    const scope = collectDescendantSpecialties([1], tree)

    expect(Array.from(scope).sort((a, b) => a - b)).toEqual([1, 2, 3])
  })
})
