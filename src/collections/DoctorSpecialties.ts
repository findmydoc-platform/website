// src/collections/DoctorSpecialties.ts
import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { platformOrOwnClinicDoctorResource } from '@/access/scopeFilters'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'

export const DoctorSpecialties: CollectionConfig = {
  slug: 'doctorspecialties',
  labels: {
    singular: 'Doctor Specialty',
    plural: 'Doctor Specialties',
  },
  admin: {
    group: 'Medical Network',
    description:
      'Connects doctors with their medical specialties and records their level of expertise',
    useAsTitle: 'id',
    defaultColumns: ['doctor', 'medicalSpecialty', 'specializationLevel'],
  },
  access: {
    read: anyone, // Public read access
    create: platformOrOwnClinicDoctorResource, // Platform: all, Clinic: only doctors from their clinic
    update: platformOrOwnClinicDoctorResource, // Platform: all, Clinic: only doctors from their clinic  
    delete: isPlatformBasicUser, // Only Platform can delete
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
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
        description: `Level of expertise the doctor has in this specialty`,
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
