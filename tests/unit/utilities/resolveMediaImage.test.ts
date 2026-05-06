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

  it('preserves full query content when file URLs contain additional question marks', () => {
    const image = resolveMediaImage(
      {
        alt: 'Example',
        url: '/api/clinicMedia/file/folder%2Fimg.jpg?note=first?second&lang=de',
        width: 1200,
        height: 800,
      },
      'Fallback alt',
    )

    expect(image).toEqual({
      src: '/api/clinicMedia/file/folder/img.jpg?note=first?second&lang=de',
      alt: 'Example',
      width: 1200,
      height: 800,
    })
  })
})
