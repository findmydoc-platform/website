import {
  doctorSourceAccess,
  doctorCreateAccess,
  doctorRelatedPublicRead,
  guardDoctorOperation,
  guardDoctorChange,
  verifyDoctorOperation,
} from '@/features/doctorProfiles/authorization'
import { CollectionConfig } from 'payload'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'

export const DoctorTreatments: CollectionConfig = {
  slug: 'doctortreatments',
  labels: {
    singular: 'Doctor Treatment',
    plural: 'Doctor Treatments',
  },
  admin: {
    group: 'Medical Network',
    description: 'Doctors and their treatments',
    useAsTitle: 'id',
    defaultColumns: ['doctor', 'treatment', 'specializationLevel'],
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
    beforeChange: [stableIdBeforeChangeHook, guardDoctorChange],
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
        description: 'Doctor for this treatment',
        allowCreate: false,
      },
      filterOptions: ({ req }) => (!req.user ? true : doctorSourceAccess()({ req })),
    },
    {
      name: 'treatment',
      type: 'relationship',
      relationTo: 'treatments',
      hasMany: false,
      required: true,
      admin: {
        description: 'Treatment this doctor offers',
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
        description: 'How advanced the doctor is with this treatment',
      },
    },
    {
      name: 'treatmentsPerformed',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'How many times the doctor has performed this treatment',
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
