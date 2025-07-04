// src/collections/DoctorSpecialties.ts
import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'

export const DoctorSpecialties: CollectionConfig = {
  slug: 'doctorspecialties',
  labels: {
    singular: 'Doctor Specialty',
    plural: 'Doctor Specialties',
  },
  admin: {
    group: 'Medical Network',
    description:
      'Links a doctor to a medical specialty, specifying their specialization level and certifications.',
    useAsTitle: 'id',
    defaultColumns: ['doctor', 'medicalSpecialty', 'specializationLevel'],
  },
  access: {
    read: anyone,
    create: ({ req }) => isPlatformBasicUser({ req }) || isClinicBasicUser({ req }),
    update: ({ req }) => isPlatformBasicUser({ req }) || isClinicBasicUser({ req }),
    delete: isPlatformBasicUser,
  },
  timestamps: true,
  fields: [
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      hasMany: false,
      required: true,
      admin: {
        description: 'Link to the doctor.',
        allowCreate: false,
      },
    },
    {
      name: 'medicalSpecialty',
      type: 'relationship',
      relationTo: 'medical-specialties',
      hasMany: false,
      required: true,
      admin: {
        description: 'Link to the medical specialty.',
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
        description: `The doctor's level of specialization for this medical specialty.`,
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
        description: 'List of certifications related to this specialty for the doctor.',
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
