import { CollectionConfig } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'

export const MedicalSpecialties: CollectionConfig = {
  slug: 'medical-specialties',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['name', 'description', 'parentSpecialty'],
    description:
      'Medical fields and areas of specialization. Organize healthcare services by specialty to help patients find the right type of care for their needs.',
  },
  access: {
    read: () => true,
    create: ({ req }) => isPlatformBasicUser({ req }) || isClinicBasicUser({ req }),
    update: ({ req }) => isPlatformBasicUser({ req }) || isClinicBasicUser({ req }),
    delete: isPlatformBasicUser,
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
      on: 'medicalSpecialty',
      admin: {
        defaultColumns: ['doctor', 'specializationLevel', 'certifications'],
        description:
          'Doctors associated with this specialty, their specialization level, and certifications.',
        allowCreate: true,
      },
    },
  ],
}
