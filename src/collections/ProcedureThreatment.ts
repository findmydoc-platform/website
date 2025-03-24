import { CollectionConfig } from 'payload'

export const ProcedureTreatment: CollectionConfig = {
  slug: 'procedure-threatment',
  fields: [
    {
      name: 'treatment',
      type: 'relationship',
      relationTo: 'threatments',
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
