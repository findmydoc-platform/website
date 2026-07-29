import { CollectionConfig } from 'payload'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import {
  platformOrAssignedClinicMutation,
  platformOrOwnClinicResource,
  platformOrOwnClinicResourceOrActive,
} from '@/access/scopeFilters'
import { updateAveragePriceAfterChange } from './hooks/updateAveragePriceAfterChange'
import { updateAveragePriceAfterDelete } from './hooks/updateAveragePriceAfterDelete'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import { beforeChangeAssignClinicFromUser } from '@/hooks/clinicOwnership'
import { revalidateClinicTreatmentChange, revalidateClinicTreatmentDelete } from '@/hooks/revalidateClinicSurfaces'

export const ClinicTreatments: CollectionConfig = {
  slug: 'clinictreatments',
  labels: {
    singular: 'Clinic Treatment',
    plural: 'Clinic Treatments',
  },
  admin: {
    group: 'Medical Network',
    description: 'Treatments offered by clinics with EUR prices and public activation status',
    useAsTitle: 'id',
    defaultColumns: ['clinic', 'treatment', 'price', 'active'],
  },
  access: {
    read: platformOrOwnClinicResourceOrActive,
    create: platformOrAssignedClinicMutation, // Platform: all, Clinic: assigned clinic only
    update: platformOrOwnClinicResource, // Platform: all, Clinic: only their clinic
    delete: isPlatformStaff, // Only Platform can delete
  },
  timestamps: true,
  hooks: {
    beforeChange: [stableIdBeforeChangeHook, beforeChangeAssignClinicFromUser({ clinicField: 'clinic' })],
    afterChange: [updateAveragePriceAfterChange, revalidateClinicTreatmentChange],
    afterDelete: [updateAveragePriceAfterDelete, revalidateClinicTreatmentDelete],
  },
  fields: [
    stableIdField(),
    {
      name: 'price',
      label: 'Price (EUR)',
      type: 'number',
      required: true,
      admin: {
        description: 'Price the clinic charges in EUR',
      },
    },
    {
      name: 'active',
      label: 'Publicly Offered',
      type: 'checkbox',
      defaultValue: false,
      required: true,
      admin: {
        description: 'Show this treatment publicly and include it in prices and patient inquiries.',
        position: 'sidebar',
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
        condition: (_data, _siblingData, { user }) => !(user && user.collection === 'clinicStaff'),
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
