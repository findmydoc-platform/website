import { isPatient } from '@/access/isPatient'
import type { CollectionConfig } from 'payload'
import { platformOrOwnPatientResource } from '@/access/scopeFilters'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'

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
    read: platformOrOwnPatientResource,
    create: ({ req }) => {
      if (isPlatformBasicUser({ req })) return true
      return isPatient({ req })
    },
    update: platformOrOwnPatientResource,
    delete: platformOrOwnPatientResource,
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation !== 'create') return data

        if (req.user && req.user.collection === 'patients') {
          const draft = { ...(data || {}) } as Record<string, unknown>

          const provided = draft.patient
          if (provided != null && String(provided) !== String(req.user.id)) {
            throw new Error('Patients can only create favorites for themselves')
          }

          draft.patient = req.user.id
          return draft
        }

        return data
      },
    ],
  },
  timestamps: true,
  fields: [
    stableIdField(),
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
