import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { platformOrOwnClinicResource } from '@/access/scopeFilters'
import { updateAveragePriceAfterChange } from './ClinicTreatments/hooks/updateAveragePriceAfterChange'
import { updateAveragePriceAfterDelete } from './ClinicTreatments/hooks/updateAveragePriceAfterDelete'

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
    read: anyone, // Public read access
    create: platformOrOwnClinicResource, // Platform: all, Clinic: only their clinic
    update: platformOrOwnClinicResource, // Platform: all, Clinic: only their clinic
    delete: isPlatformBasicUser, // Only Platform can delete
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
