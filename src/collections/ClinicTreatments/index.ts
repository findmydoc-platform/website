import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { platformOrAssignedClinicMutation, platformOrOwnClinicResource } from '@/access/scopeFilters'
import { updateAveragePriceAfterChange } from './hooks/updateAveragePriceAfterChange'
import { updateAveragePriceAfterDelete } from './hooks/updateAveragePriceAfterDelete'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import { beforeChangeAssignClinicFromUser } from '@/hooks/clinicOwnership'

export const ClinicTreatments: CollectionConfig = {
  slug: 'clinictreatments',
  labels: {
    singular: 'Clinic Treatment',
    plural: 'Clinic Treatments',
  },
  admin: {
    group: 'Medical Network',
    description: 'Links clinics to treatments and their price',
    useAsTitle: 'id',
    defaultColumns: ['clinic', 'treatment', 'price'],
  },
  access: {
    read: anyone, // Public read access
    create: platformOrAssignedClinicMutation, // Platform: all, Clinic: assigned clinic only
    update: platformOrOwnClinicResource, // Platform: all, Clinic: only their clinic
    delete: isPlatformBasicUser, // Only Platform can delete
  },
  timestamps: true,
  hooks: {
    beforeChange: [stableIdBeforeChangeHook, beforeChangeAssignClinicFromUser({ clinicField: 'clinic' })],
    afterChange: [updateAveragePriceAfterChange],
    afterDelete: [updateAveragePriceAfterDelete],
  },
  fields: [
    stableIdField(),
    {
      name: 'price',
      label: 'Price (USD)',
      type: 'number',
      required: true,
      admin: {
        description: 'Price the clinic charges in USD',
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      hasMany: false,
      required: true,
      admin: {
        description: 'Clinic that offers this treatment',
        allowCreate: false,
        condition: (_data, _siblingData, { user }) =>
          !(user && user.collection === 'basicUsers' && user.userType === 'clinic'),
      },
    },
    {
      name: 'treatment',
      type: 'relationship',
      relationTo: 'treatments',
      hasMany: false,
      required: true,
      admin: {
        description: 'Treatment offered by the clinic',
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
