import { describe, expect, it } from 'vitest'

import { resolveMediaDescriptorFromLoadedRelation } from '@/utilities/media/relationMedia'

describe('resolveMediaDescriptorFromLoadedRelation', () => {
  it('prefers relation URL when already present', () => {
    const descriptor = resolveMediaDescriptorFromLoadedRelation(
      {
        id: 10,
        url: '/api/clinicMedia/file/already-present.jpg',
        filename: 'ignored.jpg',
        alt: 'Clinic image',
      },
      'clinicMedia',
    )

    expect(descriptor).toEqual({
      url: '/api/clinicMedia/file/already-present.jpg',
      alt: 'Clinic image',
    })
  })

  it('derives a media URL from filename when relation URL is missing', () => {
    const descriptor = resolveMediaDescriptorFromLoadedRelation(
      {
        id: 11,
        url: null,
        filename: 'derived.jpg',
        alt: 'Derived image',
      },
      'clinicMedia',
    )

    expect(descriptor).toEqual({
      url: '/api/clinicMedia/file/derived.jpg',
      alt: 'Derived image',
    })
  })
})
