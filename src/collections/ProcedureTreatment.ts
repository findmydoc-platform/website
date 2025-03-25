import { CollectionConfig } from 'payload'

export const ProcedureTreatment: CollectionConfig = {
  slug: 'procedure-treatment',
  fields: [
    {
      name: 'treatment',
      type: 'relationship',
      relationTo: 'treatments',
      required: true,
    },
    {
      name: 'procedure',
      type: 'relationship',
      relationTo: 'procedures',
      required: true,
    },
  ],
}
