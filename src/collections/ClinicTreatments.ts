import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import {
  updateAveragePriceAfterChange,
  updateAveragePriceAfterDelete,
} from '@/hooks/calculations/updateAveragePrices'

export const ClinicTreatments: CollectionConfig = {
  slug: 'clinictreatments',
  labels: {
    singular: 'Clinic Treatment',
    plural: 'Clinic Treatments',
  },
  admin: {
    group: 'Medical Network',
    description: 'Link a treatment to a clinic with a price',
    useAsTitle: 'id',
    defaultColumns: ['clinic', 'treatment', 'price'],
  },
  access: {
    read: anyone,
    create: ({ req }) => isPlatformBasicUser({ req }) || isClinicBasicUser({ req }),
    update: ({ req }) => isPlatformBasicUser({ req }) || isClinicBasicUser({ req }),
    delete: isPlatformBasicUser,
  },
  timestamps: true,
  hooks: {
    afterChange: [updateAveragePriceAfterChange],
    afterDelete: [updateAveragePriceAfterDelete],
  },
  fields: [
    {
      name: 'price',
      type: 'number',
      required: true,
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      hasMany: false,
      required: true,
      admin: {
        description: 'Link to the clinic',
        allowCreate: false,
      },
    },
    {
      name: 'treatment',
      type: 'relationship',
      relationTo: 'treatments',
      hasMany: false,
      required: true,
      admin: {
        description: 'Link to the treatment',
        allowCreate: false,
      },
    },
  ],
  indexes: [
    {
      fields: ['clinic', 'treatment'],
      unique: true,
    },
  ],
}
