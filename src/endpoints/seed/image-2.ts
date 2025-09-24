import type { PlatformContentMedia } from '@/payload-types'

export const image2: Omit<PlatformContentMedia, 'createdAt' | 'id' | 'updatedAt' | 'createdBy' | 'storagePath'> = {
  alt: 'Curving abstract shapes with an orange and blue gradient',
  caption: 'Photo by Andrew Kliatskyi on Unsplash.',
}
