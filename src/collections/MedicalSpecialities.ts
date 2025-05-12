import { CollectionConfig } from 'payload'

export const MedicalSpecialties: CollectionConfig = {
  slug: 'medical-specialties',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['name', 'description'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
      required: false,
    },
    {
      name: 'icon',
      type: 'relationship',
      relationTo: 'media',
      required: false,
      admin: {
        description: 'Icon representing this specialty',
      },
    },
    {
      name: 'parentSpecialty',
      type: 'relationship',
      relationTo: 'medical-specialties',
      required: false,
      admin: {
        description: 'Parent medical specialty (if any)',
      },
    },
    {
      name: 'doctorLinks',
      label: 'Doctors Practicing This Specialty',
      type: 'join',
      collection: 'doctorspecialties',
      on: 'doctor',
      admin: {
        defaultColumns: ['doctor', 'specializationLevel', 'certifications'],
        description:
          'Doctors associated with this specialty, their specialization level, and certifications.',
        allowCreate: true,
      },
    },
  ],
}
