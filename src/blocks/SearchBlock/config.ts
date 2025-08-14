import { Block } from 'payload'

export const SearchBlock: Block = {
  slug: 'search-block',
  labels: {
    singular: 'Search Block',
    plural: 'Search Blocks',
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: false,
      admin: {
        description: 'Optionaler Titel über dem Suchformular',
      },
    },
  ],
}
