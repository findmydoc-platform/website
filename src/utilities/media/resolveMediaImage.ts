import { splitUrlQuery } from '@/utilities/urlParts'

type MediaSize = {
  url?: string | null
  width?: number | null
  height?: number | null
}

type MediaLike = {
  url?: string | null
  alt?: string | null
  width?: number | null
  height?: number | null
  focalX?: number | null
  focalY?: number | null
  sizes?: Record<string, MediaSize | undefined>
} | null

export type ResolvedMediaImage = {
  src: string
  alt: string
  width?: number
  height?: number
  sizes: string
  quality: number
  objectPosition?: string
}

export type MediaImageUsage =
  | 'avatar'
  | 'authorAvatar'
  | 'listingCard'
  | 'blogCard'
  | 'content'
  | 'landingVisual'
  | 'landingCategory'
  | 'teamPortrait'
  | 'testimonialAvatar'
  | 'hero'
  | 'og'

type PayloadImageSize = 'thumbnail' | 'square' | 'small' | 'medium' | 'large' | 'xlarge' | 'og' | 'original'

type InternalMediaImagePolicy = {
  payloadSizeOrder: PayloadImageSize[]
  sizes: string
  quality: number
  allowThumbnailPrimary?: boolean
}

const MEDIA_IMAGE_POLICIES = {
  avatar: {
    payloadSizeOrder: ['thumbnail', 'square', 'small', 'original'],
    sizes: '48px',
    quality: 70,
    allowThumbnailPrimary: true,
  },
  authorAvatar: {
    payloadSizeOrder: ['thumbnail', 'square', 'small', 'original'],
    sizes: '40px',
    quality: 70,
    allowThumbnailPrimary: true,
  },
  listingCard: {
    payloadSizeOrder: ['medium', 'small', 'large', 'original', 'thumbnail'],
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    quality: 70,
  },
  blogCard: {
    payloadSizeOrder: ['large', 'medium', 'small', 'original', 'thumbnail'],
    sizes: '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw',
    quality: 70,
  },
  content: {
    payloadSizeOrder: ['large', 'medium', 'original', 'small', 'thumbnail'],
    sizes: '(max-width: 768px) 100vw, 960px',
    quality: 70,
  },
  landingVisual: {
    payloadSizeOrder: ['xlarge', 'large', 'original', 'medium', 'small', 'thumbnail'],
    sizes: '(max-width: 1024px) 100vw, 50vw',
    quality: 85,
  },
  landingCategory: {
    payloadSizeOrder: ['xlarge', 'large', 'original', 'medium', 'small', 'thumbnail'],
    sizes: '(min-width: 1024px) 45vw, (min-width: 768px) 50vw, 100vw',
    quality: 85,
  },
  teamPortrait: {
    payloadSizeOrder: ['xlarge', 'large', 'original', 'medium', 'small', 'thumbnail'],
    sizes: '(min-width: 768px) 33vw, (min-width: 640px) 50vw, 85vw',
    quality: 85,
  },
  testimonialAvatar: {
    payloadSizeOrder: ['small', 'square', 'thumbnail', 'medium', 'large', 'original'],
    sizes: '(min-width: 640px) 80px, 64px',
    quality: 85,
  },
  hero: {
    payloadSizeOrder: ['xlarge', 'large', 'original', 'medium'],
    sizes: '100vw',
    quality: 85,
  },
  og: {
    payloadSizeOrder: ['og', 'large', 'original'],
    sizes: '1200px',
    quality: 75,
  },
} satisfies Record<MediaImageUsage, InternalMediaImagePolicy>

for (const [usage, policy] of Object.entries(MEDIA_IMAGE_POLICIES)) {
  if (
    policy.payloadSizeOrder[0] === 'thumbnail' &&
    (!('allowThumbnailPrimary' in policy) || policy.allowThumbnailPrimary !== true)
  ) {
    throw new Error(`Media image policy "${usage}" must explicitly allow thumbnail as its primary size`)
  }
}

const normalizePayloadApiFileUrl = (src: string): string => {
  if (!src.includes('/api/') || !src.includes('/file/')) return src

  const { path: pathPart, query } = splitUrlQuery(src)
  const marker = '/file/'
  const markerIndex = pathPart.indexOf(marker)

  if (markerIndex === -1) return src

  const prefix = pathPart.slice(0, markerIndex + marker.length)
  const rawFilePart = pathPart.slice(markerIndex + marker.length)
  const decodedFilePart = decodeURIComponent(rawFilePart)
  const normalizedPath = decodedFilePart
    .replace(/^\/+/, '')
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')

  return query ? `${prefix}${normalizedPath}?${query}` : `${prefix}${normalizedPath}`
}

const normalizeFocalCoordinate = (value: number | null | undefined): number | undefined => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined

  return Math.min(100, Math.max(0, value))
}

const resolveObjectPosition = (media: MediaLike): string | undefined => {
  const focalX = normalizeFocalCoordinate(media?.focalX)
  const focalY = normalizeFocalCoordinate(media?.focalY)

  if (focalX === undefined && focalY === undefined) return undefined

  return `${focalX ?? 50}% ${focalY ?? 50}%`
}

export function resolveMediaImage(
  media: MediaLike,
  options: {
    fallbackAlt?: string
    usage: MediaImageUsage
  },
): ResolvedMediaImage | undefined {
  if (!media) return undefined

  const policy = MEDIA_IMAGE_POLICIES[options.usage]
  const alt = media.alt ?? options.fallbackAlt ?? ''
  const sizes = media.sizes ?? {}
  const objectPosition = resolveObjectPosition(media)

  for (const key of policy.payloadSizeOrder) {
    if (key === 'original') {
      if (!media.url) continue

      return {
        src: normalizePayloadApiFileUrl(media.url),
        alt,
        width: media.width ?? undefined,
        height: media.height ?? undefined,
        sizes: policy.sizes,
        quality: policy.quality,
        ...(objectPosition ? { objectPosition } : {}),
      }
    }

    const size = sizes[key]
    if (size?.url) {
      return {
        src: normalizePayloadApiFileUrl(size.url),
        alt,
        width: size.width ?? undefined,
        height: size.height ?? undefined,
        sizes: policy.sizes,
        quality: policy.quality,
        ...(objectPosition ? { objectPosition } : {}),
      }
    }
  }

  return undefined
}
