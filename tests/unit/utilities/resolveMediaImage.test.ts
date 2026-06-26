import { describe, expect, it } from 'vitest'

import * as mediaImageModule from '@/utilities/media/resolveMediaImage'
import { resolveMediaImage, type MediaImageUsage } from '@/utilities/media/resolveMediaImage'

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
      {
        fallbackAlt: 'Fallback alt',
        usage: 'content',
      },
    )

    expect(image).toEqual({
      src: '/api/clinicMedia/file/example.jpg',
      alt: '',
      width: 640,
      height: 480,
      sizes: '(max-width: 768px) 100vw, 960px',
      quality: 70,
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
      {
        fallbackAlt: 'Fallback alt',
        usage: 'hero',
      },
    )

    expect(image).toEqual({
      src: '/api/clinicMedia/file/folder/img.jpg?note=first?second&lang=de',
      alt: 'Example',
      width: 1200,
      height: 800,
      sizes: '100vw',
      quality: 85,
    })
  })

  it('prefers the original image before falling back to a thumbnail', () => {
    const image = resolveMediaImage(
      {
        alt: 'Example',
        url: '/api/platformContentMedia/file/process-step-2-create-profile-v3.webp',
        width: 576,
        height: 968,
        sizes: {
          thumbnail: {
            url: '/api/platformContentMedia/file/process-step-2-create-profile-v3-300x504.webp',
            width: 300,
            height: 504,
          },
        },
      },
      {
        fallbackAlt: 'Fallback alt',
        usage: 'landingVisual',
      },
    )

    expect(image).toEqual({
      src: '/api/platformContentMedia/file/process-step-2-create-profile-v3.webp',
      alt: 'Example',
      width: 576,
      height: 968,
      sizes: '(max-width: 1024px) 100vw, 50vw',
      quality: 85,
    })
  })

  it('uses the largest configured public size for large visual contexts', () => {
    const image = resolveMediaImage(
      {
        alt: 'Example',
        url: '/api/platformContentMedia/file/example.webp',
        width: 1600,
        height: 1000,
        sizes: {
          medium: {
            url: '/api/platformContentMedia/file/example-900x563.webp',
            width: 900,
            height: 563,
          },
          large: {
            url: '/api/platformContentMedia/file/example-1400x875.webp',
            width: 1400,
            height: 875,
          },
        },
      },
      {
        fallbackAlt: 'Fallback alt',
        usage: 'landingVisual',
      },
    )

    expect(image).toMatchObject({
      src: '/api/platformContentMedia/file/example-1400x875.webp',
      width: 1400,
      height: 875,
      sizes: '(max-width: 1024px) 100vw, 50vw',
      quality: 85,
    })
  })

  it('maps Payload focal point coordinates to CSS object position', () => {
    const image = resolveMediaImage(
      {
        alt: 'Focused team photo',
        url: '/api/platformContentMedia/file/team.webp',
        width: 1200,
        height: 800,
        focalX: 31,
        focalY: 68,
      },
      {
        fallbackAlt: 'Fallback alt',
        usage: 'landingVisual',
      },
    )

    expect(image).toMatchObject({
      src: '/api/platformContentMedia/file/team.webp',
      objectPosition: '31% 68%',
    })
  })

  it('clamps invalid focal point coordinates before creating CSS object position', () => {
    const image = resolveMediaImage(
      {
        alt: 'Focused team photo',
        url: '/api/platformContentMedia/file/team.webp',
        width: 1200,
        height: 800,
        focalX: -20,
        focalY: 140,
      },
      {
        fallbackAlt: 'Fallback alt',
        usage: 'landingVisual',
      },
    )

    expect(image).toMatchObject({
      objectPosition: '0% 100%',
    })
  })

  it('allows thumbnail as the primary size only for avatar contexts', () => {
    const media = {
      alt: 'Avatar',
      url: '/api/userProfileMedia/file/avatar.webp',
      width: 900,
      height: 900,
      sizes: {
        thumbnail: {
          url: '/api/userProfileMedia/file/avatar-300x300.webp',
          width: 300,
          height: 300,
        },
      },
    }

    expect(resolveMediaImage(media, { fallbackAlt: 'Fallback alt', usage: 'avatar' })).toMatchObject({
      src: '/api/userProfileMedia/file/avatar-300x300.webp',
      sizes: '48px',
    })
    expect(resolveMediaImage(media, { fallbackAlt: 'Fallback alt', usage: 'hero' })).toMatchObject({
      src: '/api/userProfileMedia/file/avatar.webp',
      sizes: '100vw',
    })
  })

  it('uses high-quality delivery policies for public landing imagery', () => {
    const media = {
      alt: 'Clinic image',
      url: '/api/platformContentMedia/file/original.webp',
      width: 2400,
      height: 1600,
      sizes: {
        thumbnail: {
          url: '/api/platformContentMedia/file/thumbnail.webp',
          width: 300,
          height: 200,
        },
        large: {
          url: '/api/platformContentMedia/file/large.webp',
          width: 1400,
          height: 933,
        },
        xlarge: {
          url: '/api/platformContentMedia/file/xlarge.webp',
          width: 1920,
          height: 1280,
        },
      },
    }

    expect(resolveMediaImage(media, { usage: 'landingVisual' })).toMatchObject({
      src: '/api/platformContentMedia/file/xlarge.webp',
      sizes: '(max-width: 1024px) 100vw, 50vw',
      quality: 85,
    })
    expect(resolveMediaImage(media, { usage: 'teamPortrait' })).toMatchObject({
      src: '/api/platformContentMedia/file/xlarge.webp',
      sizes: '(min-width: 768px) 33vw, (min-width: 640px) 50vw, 85vw',
      quality: 85,
    })
    expect(resolveMediaImage(media, { usage: 'landingCategory' })).toMatchObject({
      src: '/api/platformContentMedia/file/xlarge.webp',
      sizes: '(min-width: 1024px) 45vw, (min-width: 768px) 50vw, 100vw',
      quality: 85,
    })
    expect(resolveMediaImage(media, { usage: 'testimonialAvatar' })).toMatchObject({
      src: '/api/platformContentMedia/file/thumbnail.webp',
      sizes: '(min-width: 640px) 80px, 64px',
      quality: 85,
    })
  })

  it('uses generated team portrait sizes before falling back to original uploads', () => {
    const media = {
      alt: 'Team portrait',
      url: '/api/platformContentMedia/file/hash-team-member.webp',
      width: 768,
      height: 1344,
      sizes: {
        small: {
          url: '/api/platformContentMedia/file/team-member-600x1050.webp',
          width: 600,
          height: 1050,
        },
        medium: {
          url: '/api/platformContentMedia/file/team-member-900x1575.webp',
          width: 900,
          height: 1575,
        },
      },
    }

    expect(resolveMediaImage(media, { usage: 'teamPortrait' })).toMatchObject({
      src: '/api/platformContentMedia/file/team-member-900x1575.webp',
      sizes: '(min-width: 768px) 33vw, (min-width: 640px) 50vw, 85vw',
      quality: 85,
    })
  })

  it('keeps internal media policies private while every public usage resolves', () => {
    expect('MEDIA_IMAGE_POLICIES' in mediaImageModule).toBe(false)

    const usages: MediaImageUsage[] = [
      'avatar',
      'authorAvatar',
      'listingCard',
      'blogCard',
      'content',
      'landingVisual',
      'landingCategory',
      'teamPortrait',
      'testimonialAvatar',
      'hero',
      'og',
    ]

    for (const usage of usages) {
      expect(
        resolveMediaImage(
          {
            alt: 'Example',
            url: `/api/platformContentMedia/file/${usage}.webp`,
            width: 1200,
            height: 800,
          },
          {
            fallbackAlt: 'Fallback alt',
            usage,
          },
        ),
      ).toEqual(
        expect.objectContaining({
          alt: 'Example',
          src: `/api/platformContentMedia/file/${usage}.webp`,
        }),
      )
    }
  })
})
