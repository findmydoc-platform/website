import { CollectionConfig } from 'payload'

export const DoctorTreatments: CollectionConfig = {
  slug: 'doctortreatments',
  labels: {
    singular: 'Doctor Treatment',
    plural: 'Doctor Treatments',
  },
  admin: {
    group: 'Medical Network',
    description:
      'Link a treatment to a doctor, specifying their specialization level for that treatment.',
    useAsTitle: 'id',
    defaultColumns: ['doctor', 'treatment', 'specializationLevel'],
  },
  access: {
    read: () => true,
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
        description: `The doctor's level of specialization for this specific treatment.`,
      },
    },
    {
      name: 'treatmentsPerformed',
      type: 'number',
      admin: {
        readOnly: true,
        description:
          'Placeholder for the number of times this treatment has been performed by the doctor.',
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
