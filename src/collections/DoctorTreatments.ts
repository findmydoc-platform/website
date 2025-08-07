import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { platformOrOwnClinicDoctorResource } from '@/access/scopeFilters'

export const DoctorTreatments: CollectionConfig = {
  slug: 'doctortreatments',
  labels: {
    singular: 'Doctor Treatment',
    plural: 'Doctor Treatments',
  },
  admin: {
    group: 'Medical Network',
    description:
      'Assign treatments to doctors and track their expertise level',
    useAsTitle: 'id',
    defaultColumns: ['doctor', 'treatment', 'specializationLevel'],
  },
  access: {
    read: anyone, // Public read access
    create: platformOrOwnClinicDoctorResource, // Platform: all, Clinic: only doctors from their clinic
    update: platformOrOwnClinicDoctorResource, // Platform: all, Clinic: only doctors from their clinic
    delete: isPlatformBasicUser, // Only Platform can delete
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
      name: 'treatment',
      type: 'relationship',
      relationTo: 'treatments',
      hasMany: false,
      required: true,
      admin: {
        description: 'Link to the treatment.',
        allowCreate: false,
      },
    },
    {
      name: 'specializationLevel',
      type: 'select',
      required: true,
      options: [
        { label: 'General Practice', value: 'general_practice' },
        { label: 'Specialist', value: 'specialist' },
        { label: 'Sub-specialist', value: 'sub_specialist' },
      ],
      admin: {
        description: `Doctor's expertise level for this treatment`,
      },
    },
    {
      name: 'treatmentsPerformed',
      type: 'number',
      admin: {
        readOnly: true,
        description:
          'Number of times this doctor has performed the treatment',
        condition: () => false, // Hides the field from the edit view by default but shows in list view if in defaultColumns
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
  ],
  indexes: [
    {
      fields: ['doctor', 'treatment'],
      unique: true,
    },
  ],
}
