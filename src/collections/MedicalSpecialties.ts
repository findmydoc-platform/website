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
    description:
      'Medical specialties support a strict L1/L2 hierarchy. Level 3 belongs to Treatments and must not be created as a specialty.',
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
      name: 'featureImage',
      type: 'relationship',
      relationTo: 'platformContentMedia',
      required: false,
      admin: {
        description: 'Feature image representing this specialty',
      },
    },
    {
      name: 'parentSpecialty',
      type: 'relationship',
      relationTo: 'medical-specialties',
      required: false,
      admin: {
        position: 'sidebar',
        description: 'Optional parent specialty. Only one nesting level is allowed (L1 -> L2).',
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
