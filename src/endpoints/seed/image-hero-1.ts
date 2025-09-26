import type { PlatformContentMedia } from '@/payload-types'

export const imageHero1: Omit<PlatformContentMedia, 'createdAt' | 'id' | 'updatedAt' | 'createdBy' | 'storagePath'> = {
  alt: 'Straight metallic shapes with a blue gradient',
}
