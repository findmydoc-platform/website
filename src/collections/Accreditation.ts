import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'
import { revalidateAccreditationChange, revalidateAccreditationDelete } from '@/hooks/revalidateClinicSurfaces'

export const Accreditation: CollectionConfig = {
  slug: 'accreditation',
  admin: {
    group: 'Platform Management',
    useAsTitle: 'name',
    defaultColumns: ['name', 'abbreviation'],
    description: 'Accreditations for clinics',
  },
  access: {
    read: anyone,
    create: isPlatformStaff,
    update: isPlatformStaff,
    delete: isPlatformStaff,
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
    afterChange: [revalidateAccreditationChange],
    afterDelete: [revalidateAccreditationDelete],
  },
  fields: [
    stableIdField(),
    {
      type: 'row',
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          admin: {
            width: '70%',
          },
        },
        {
          name: 'abbreviation',
          type: 'text',
          required: true,
          admin: {
            width: '30%',
          },
        },
      ],
    },
    {
      name: 'country',
      type: 'text',
      required: true,
      admin: {
        description: 'Country that issues this accreditation',
      },
    },
    {
      name: 'description',
      type: 'richText',
      admin: {
        description: 'What this accreditation covers',
      },
      required: true,
    },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'platformContentMedia',
      required: false,
      admin: {
        description: 'Logo or symbol for this accreditation',
      },
    },
  ],
}
