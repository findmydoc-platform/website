import { isPatient } from '@/access/isPatient'
import type { CollectionConfig } from 'payload'

export const FavoriteClinics: CollectionConfig = {
  slug: 'favoriteclinics',
  labels: {
    singular: 'Favorite Clinic',
    plural: 'Favorite Clinics',
  },
  admin: {
    group: 'Medical Network',
    description: 'Join table linking patients to their favorite clinics',
    useAsTitle: 'id',
    defaultColumns: ['patient', 'clinic'],
  },
  access: {
    read: () => true, //
    create: isPatient,
    update: isPatient,
    delete: isPatient,
  },
  timestamps: true,
  fields: [
    {
      name: 'patient',
      type: 'relationship',
      relationTo: 'patients',
      hasMany: false,
      required: true,
      admin: {
        description: 'Link to the patient.',
        allowCreate: false,
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      hasMany: false,
      required: true,
      admin: {
        description: 'Link to the clinic.',
        allowCreate: false,
      },
    },
  ],
  indexes: [
    {
      fields: ['patient', 'clinic'],
      unique: true,
    },
  ],
}
