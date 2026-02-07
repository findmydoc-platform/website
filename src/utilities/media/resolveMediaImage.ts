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
}

const DEFAULT_SIZE_ORDER = ['xlarge', 'large', 'medium', 'small', 'thumbnail']

const normalizePayloadApiFileUrl = (src: string): string => {
  if (!src.includes('/api/') || !src.includes('/file/')) return src

  const [pathPart = '', queryPart] = src.split('?')
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

  return queryPart ? `${prefix}${normalizedPath}?${queryPart}` : `${prefix}${normalizedPath}`
}

export function resolveMediaImage(
  media: MediaLike,
  fallbackAlt?: string,
  sizeOrder: string[] = DEFAULT_SIZE_ORDER,
): ResolvedMediaImage | undefined {
  if (!media) return undefined

  const alt = media.alt || fallbackAlt || ''
  const sizes = media.sizes ?? {}

  for (const key of sizeOrder) {
    const size = sizes[key]
    if (size?.url) {
      return {
        src: normalizePayloadApiFileUrl(size.url),
        alt,
        width: size.width ?? undefined,
        height: size.height ?? undefined,
      }
    }
  }

  if (media.url) {
    return {
      src: normalizePayloadApiFileUrl(media.url),
      alt,
      width: media.width ?? undefined,
      height: media.height ?? undefined,
    }
  }

  return undefined
}
