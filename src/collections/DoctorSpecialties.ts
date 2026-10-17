import {
  doctorSourceAccess,
  doctorCreateAccess,
  doctorRelatedPublicRead,
  guardDoctorOperation,
  guardDoctorChange,
  verifyDoctorOperation,
} from '@/features/doctorProfiles/authorization'
// src/collections/DoctorSpecialties.ts
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { extractRelationId } from '@/collections/common/mediaPathHelpers'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import { revalidateDoctorSpecialtyChange, revalidateDoctorSpecialtyDelete } from '@/hooks/revalidateClinicSurfaces'

const beforeChangeNormalizeMedicalSpecialty: CollectionBeforeChangeHook = ({ data }) => {
  const draft = { ...(data || {}) } as Record<string, unknown>
  const specialtyId = extractRelationId(
    draft.medicalSpecialty as string | number | { id?: string | number; value?: string | number } | null,
  )
  if (!specialtyId) return draft

  const numericSpecialtyId = Number(specialtyId)
  if (Number.isSafeInteger(numericSpecialtyId) && numericSpecialtyId > 0) {
    draft.medicalSpecialty = numericSpecialtyId
  }

  return draft
}

export const DoctorSpecialties: CollectionConfig = {
  slug: 'doctorspecialties',
  labels: {
    singular: 'Doctor Specialty',
    plural: 'Doctor Specialties',
  },
  admin: {
    group: 'Medical Network',
    description: 'Doctors and their specialties',
    useAsTitle: 'id',
    defaultColumns: ['doctor', 'medicalSpecialty', 'specializationLevel'],
  },
  access: {
    read: doctorRelatedPublicRead, // Public read access
    create: doctorCreateAccess, // Platform: all, Clinic: assigned clinic only
    update: doctorSourceAccess('doctor.clinic'), // Platform: all, Clinic: only doctors from their clinic
    delete: isPlatformStaff, // Only Platform can delete
  },
  hooks: {
    beforeOperation: [guardDoctorOperation],
    afterOperation: [verifyDoctorOperation],
    beforeChange: [stableIdBeforeChangeHook, beforeChangeNormalizeMedicalSpecialty, guardDoctorChange],
    afterChange: [revalidateDoctorSpecialtyChange],
    afterDelete: [revalidateDoctorSpecialtyDelete],
  },
  timestamps: true,
  fields: [
    stableIdField(),
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      hasMany: false,
      required: true,
      admin: {
        description: 'Doctor in this specialty',
        allowCreate: false,
      },
      filterOptions: ({ req }) => (!req.user ? true : doctorSourceAccess()({ req })),
    },
    {
      name: 'medicalSpecialty',
      type: 'relationship',
      relationTo: 'medical-specialties',
      hasMany: false,
      required: true,
      admin: {
        description: 'Specialty for this doctor',
        allowCreate: false,
      },
    },
    {
      name: 'specializationLevel',
      type: 'select',
      required: true,
      options: [
        { label: 'Beginner', value: 'beginner' },
        { label: 'Intermediate', value: 'intermediate' },
        { label: 'Advanced', value: 'advanced' },
        { label: 'Expert', value: 'expert' },
        { label: 'Specialist', value: 'specialist' },
      ],
      admin: {
        description: 'How advanced the doctor is in this specialty',
      },
    },
    {
      name: 'certifications',
      label: 'Certifications',
      type: 'array',
      minRows: 0,
      fields: [
        {
          name: 'certification',
          type: 'text',
          label: 'Certification',
        },
      ],
      admin: {
        description: 'Certifications for this specialty',
      },
    },
  ],
  indexes: [
    {
      fields: ['doctor', 'medicalSpecialty'],
      unique: true,
    },
  ],
}
