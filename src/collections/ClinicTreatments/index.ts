import { CollectionConfig } from 'payload'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import {
  clinicTreatmentCreateAccess,
  clinicTreatmentUpdateAccess,
  clinicTreatmentReadAccess,
  guardClinicTreatmentOperation,
  guardClinicTreatmentChange,
  verifyClinicTreatmentOperation,
} from '@/features/clinicDashboard/treatments/authorization'
import { updateAveragePriceAfterChange } from './hooks/updateAveragePriceAfterChange'
import { updateAveragePriceAfterDelete } from './hooks/updateAveragePriceAfterDelete'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import { revalidateClinicTreatmentChange, revalidateClinicTreatmentDelete } from '@/hooks/revalidateClinicSurfaces'
import { normalizeClinicTreatmentPrice, validateClinicTreatmentPrice } from './priceValidation'

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
    read: clinicTreatmentReadAccess,
    create: clinicTreatmentCreateAccess,
    update: clinicTreatmentUpdateAccess,
    delete: isPlatformStaff, // Only Platform can delete
  },
  timestamps: true,
  hooks: {
    beforeOperation: [guardClinicTreatmentOperation],
    beforeChange: [stableIdBeforeChangeHook, guardClinicTreatmentChange],
    afterOperation: [verifyClinicTreatmentOperation],
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
      min: 0,
      validate: validateClinicTreatmentPrice,
      hooks: {
        beforeValidate: [({ value }) => normalizeClinicTreatmentPrice(value)],
      },
      admin: {
        description: 'Price the clinic charges in EUR, with at most two decimal places',
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
