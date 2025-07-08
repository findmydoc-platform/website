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
    description: 'Connect clinics with the treatments they offer and the price charged',
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
      admin: {
        description: 'Price the clinic charges for this treatment',
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      hasMany: false,
      required: true,
      admin: {
        description: 'Select the clinic providing this treatment',
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
        description: 'Select the treatment being offered',
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
