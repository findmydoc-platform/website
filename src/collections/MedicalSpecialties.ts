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
    description: 'Medical specialties used to organize doctors and treatments',
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
    // Keep simple read-only admin guidance colocated with the collection schema.
    {
      name: 'taxonomyGuidance',
      type: 'ui',
      admin: {
        components: {
          Field: '@/components/organisms/MedicalSpecialtiesAdminGuidance',
        },
      },
    },
    stableIdField(),
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Specialty name',
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
      name: 'featureImage',
      type: 'relationship',
      relationTo: 'platformContentMedia',
      required: false,
      admin: {
        description: 'Image shown for this specialty',
      },
    },
    {
      name: 'parentSpecialty',
      type: 'relationship',
      relationTo: 'medical-specialties',
      required: false,
      admin: {
        position: 'sidebar',
        description: 'Broader specialty if this belongs under one',
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
        description: 'Doctors in this specialty',
        allowCreate: true,
      },
    },
  ],
}
