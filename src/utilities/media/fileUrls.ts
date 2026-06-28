import { splitUrlQuery } from '@/utilities/urlParts'

export function isPayloadApiFileUrl(src: string): boolean {
  return src.includes('/api/') && src.includes('/file/')
}

export function normalizePayloadApiFileUrl(src: string): string {
  if (!isPayloadApiFileUrl(src)) return src

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

export function versionPayloadMediaFileUrl(src: string, updatedAt?: unknown): string {
  const normalized = normalizePayloadApiFileUrl(src)

  if (!isPayloadApiFileUrl(normalized) || typeof updatedAt !== 'string' || updatedAt.trim().length === 0) {
    return normalized
  }

  const { path, query } = splitUrlQuery(normalized)
  const versionParam = `v=${encodeURIComponent(updatedAt)}`

  return query ? `${path}?${query}&${versionParam}` : `${path}?${versionParam}`
}
