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
  sizes?: Record<string, MediaSize | undefined>
} | null

export type ResolvedMediaImage = {
  src: string
  alt: string
  width?: number
  height?: number
  sizes: string
  quality: number
}

export type MediaImageUsage =
  | 'avatar'
  | 'authorAvatar'
  | 'listingCard'
  | 'blogCard'
  | 'content'
  | 'landingVisual'
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
    quality: 75,
  },
  hero: {
    payloadSizeOrder: ['xlarge', 'large', 'original', 'medium'],
    sizes: '100vw',
    quality: 75,
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
      }
    }
  }

  return undefined
}
