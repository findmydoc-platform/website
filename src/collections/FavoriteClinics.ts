import { isPatient } from '@/access/isPatient'
import type { CollectionConfig } from 'payload'
import { platformOrOwnPatientResource } from '@/access/scopeFilters'

export const FavoriteClinics: CollectionConfig = {
  slug: 'favoriteclinics',
  labels: {
    singular: 'Favorite Clinic',
    plural: 'Favorite Clinics',
  },
  admin: {
    group: 'Medical Network',
    description: 'Bookmarks that let patients save clinics they like',
    useAsTitle: 'id',
    defaultColumns: ['patient', 'clinic'],
  },
  access: {
    read: platformOrOwnPatientResource, // Platform: all favorites, Patient: only own favorites, Others: no access
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
