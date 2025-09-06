import { Media } from '@/payload-types'

/**
 * Extracts the URL from a Media object or returns null if not available.
 * Handles both Media objects and numeric IDs, returning only URLs from Media objects.
 * 
 * @param file - Media object, numeric ID, or null/undefined
 * @returns URL string if available, null otherwise
 * 
 * @example
 * getMediaUrl({ url: '/uploads/image.jpg' }) // Returns "/uploads/image.jpg"
 * getMediaUrl(123) // Returns null
 * getMediaUrl(null) // Returns null
 */
export const getMediaUrl = (file: number | Media | null | undefined): string | null => {
  if (file && typeof file === 'object' && 'url' in file) {
    return file.url || null
  }
  return null
}
