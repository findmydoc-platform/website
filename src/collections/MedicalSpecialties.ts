import { CollectionConfig } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { anyone } from '@/access/anyone'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'
import { enforceTwoLevelHierarchy } from './MedicalSpecialties/hooks/enforceTwoLevelHierarchy'

export const MedicalSpecialties: CollectionConfig = {
  slug: 'medical-specialties',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['name', 'parentSpecialty', 'updatedAt'],
    description: 'Medical specialties',
    components: {
      edit: {
        beforeDocumentControls: ['@/components/organisms/MedicalSpecialtiesAdminGuidance'],
      },
    },
  },
  access: {
    read: anyone,
    create: isPlatformBasicUser,
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook, enforceTwoLevelHierarchy],
  },
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    stableIdField(),
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Name',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      required: false,
      admin: {
        description: 'Short explanation',
      },
    },
    {
      name: 'featureImage',
      type: 'relationship',
      relationTo: 'platformContentMedia',
      required: false,
      admin: {
        description: 'Image',
      },
    },
    {
      name: 'parentSpecialty',
      type: 'relationship',
      relationTo: 'medical-specialties',
      required: false,
      admin: {
        position: 'sidebar',
        description: 'Parent specialty',
      },
    },
    {
      name: 'doctorLinks',
      label: 'Doctors in This Specialty',
      type: 'join',
      collection: 'doctorspecialties',
      on: 'medicalSpecialty',
      admin: {
        defaultColumns: ['doctor', 'specializationLevel', 'certifications'],
        description: 'Doctors linked to this specialty',
        allowCreate: true,
      },
    },
  ],
}
