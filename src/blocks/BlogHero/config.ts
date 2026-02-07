import type { Block } from 'payload'

export const BlogHero: Block = {
  slug: 'blogHero',
  interfaceName: 'BlogHeroBlock',
  fields: [
    {
      name: 'title',
      type: 'text',
      required: false,
      admin: {
        description: 'Optional custom title (defaults to "Unser Blog")',
      },
    },
    {
      name: 'subtitle',
      type: 'textarea',
      required: false,
      admin: {
        description: 'Optional custom subtitle text',
      },
    },
  ],
  labels: {
    plural: 'Blog Heroes',
    singular: 'Blog Hero',
  },
}
