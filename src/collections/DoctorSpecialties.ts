// src/collections/DoctorSpecialties.ts
import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { platformOrAssignedClinicMutation, platformOrOwnClinicDoctorResource } from '@/access/scopeFilters'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import { beforeChangeEnforceDoctorInAssignedClinic } from '@/hooks/clinicOwnership'

export const DoctorSpecialties: CollectionConfig = {
  slug: 'doctorspecialties',
  labels: {
    singular: 'Doctor Specialty',
    plural: 'Doctor Specialties',
  },
  admin: {
    group: 'Medical Network',
    description: 'Doctors and their specialty expertise',
    useAsTitle: 'id',
    defaultColumns: ['doctor', 'medicalSpecialty', 'specializationLevel'],
  },
  access: {
    read: anyone, // Public read access
    create: platformOrAssignedClinicMutation, // Platform: all, Clinic: assigned clinic only
    update: platformOrOwnClinicDoctorResource, // Platform: all, Clinic: only doctors from their clinic
    delete: isPlatformBasicUser, // Only Platform can delete
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook, beforeChangeEnforceDoctorInAssignedClinic({ doctorField: 'doctor' })],
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
      filterOptions: async ({ req }) => {
        if (!req.user) return true
        if (isPlatformBasicUser({ req })) return true
        if (!isClinicBasicUser({ req })) return false

        const clinicId = await getUserAssignedClinicId(req.user, req.payload)
        if (clinicId === null) return false

        return {
          clinic: {
            equals: clinicId,
          },
        }
      },
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
