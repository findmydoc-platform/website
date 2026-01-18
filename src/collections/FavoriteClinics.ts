import { isPatient } from '@/access/isPatient'
import type { CollectionConfig, PayloadRequest } from 'payload'
import { platformOrOwnPatientResource } from '@/access/scopeFilters'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

const resolvePatientId = (value: unknown): string | number | null => {
  if (typeof value === 'string' || typeof value === 'number') {
    return value
  }

  if (value && typeof value === 'object') {
    const record = value as { id?: string | number; value?: string | number }
    return record.value ?? record.id ?? null
  }

  return null
}

const patientMatches = (req: PayloadRequest, patientValue: unknown) => {
  const user = req.user
  if (!user || user.collection !== 'patients') return false

  const patientId = resolvePatientId(patientValue)
  if (patientId == null) return false

  return String(patientId) === String(user.id)
}

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
    create: ({ req, data }) => {
      if (isPlatformBasicUser({ req })) return true
      if (!isPatient({ req })) return false
      return patientMatches(req, (data as { patient?: unknown } | undefined)?.patient)
    },
    update: platformOrOwnPatientResource,
    delete: platformOrOwnPatientResource,
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
