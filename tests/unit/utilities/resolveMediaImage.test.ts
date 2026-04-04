import { describe, expect, it } from 'vitest'

import { resolveMediaImage } from '@/utilities/media/resolveMediaImage'

describe('resolveMediaImage', () => {
  it('preserves intentionally empty alt text instead of replacing it with fallback text', () => {
    const image = resolveMediaImage(
      {
        alt: '',
        sizes: {
          medium: {
            url: '/api/clinicMedia/file/example.jpg',
            width: 640,
            height: 480,
          },
        },
      },
      'Fallback alt',
      ['medium'],
    )

    expect(image).toEqual({
      src: '/api/clinicMedia/file/example.jpg',
      alt: '',
      width: 640,
      height: 480,
    })
  })
})
