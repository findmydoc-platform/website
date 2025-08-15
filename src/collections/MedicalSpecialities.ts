import { CollectionConfig } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { anyone } from '@/access/anyone'

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
    read: anyone,
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        description: 'Name of the medical specialty',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      required: false,
      admin: {
        description: 'Short explanation of this specialty',
      },
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
        description: 'Doctors associated with this specialty, their specialization level, and certifications.',
        allowCreate: true,
      },
    },
  ],
}
