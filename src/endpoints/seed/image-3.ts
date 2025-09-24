import type { PlatformContentMedia } from '@/payload-types'

export const image3: Omit<PlatformContentMedia, 'createdAt' | 'id' | 'updatedAt' | 'createdBy' | 'storagePath'> = {
  alt: 'Straight metallic shapes with an orange and blue gradient',
  caption: 'Photo by Andrew Kliatskyi on Unsplash.',
}
