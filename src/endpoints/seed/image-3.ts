import type { PlatformContentMedia } from '@/payload-types'

export const image3: Omit<PlatformContentMedia, 'createdAt' | 'id' | 'updatedAt' | 'createdBy' | 'storagePath'> = {
  alt: 'Straight metallic shapes with an orange and blue gradient',
  caption: {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              detail: 0,
              format: 0,
              mode: 'normal',
              style: '',
              text: 'Photo by Andrew Kliatskyi on Unsplash.',
              version: 1,
            },
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          textFormat: 0,
          version: 1,
        },
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      version: 1,
    },
  },
}
