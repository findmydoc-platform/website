import { Media } from '@/payload-types'

// This function takes a file, which can be a number, Media object, or null/undefined.
export const getMediaUrl = (file: number | Media | null | undefined): string | null => {
  if (file && typeof file === 'object' && 'url' in file) {
    return file.url || null
  }
  return null
}
