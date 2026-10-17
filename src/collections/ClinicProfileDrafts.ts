import { APIError, type CollectionConfig } from 'payload'
import {
  authorizeClinicProfileTarget,
  guardClinicProfileDraftWrite,
} from '@/features/clinicDashboard/profile/authorization'
import { requireNotificationTransaction } from '@/collections/clinicNotifications/common'
import { relationId } from './clinics/profileGallery'

import { languageOptions } from './common/selectionOptions'
import { draftOpeningHoursField } from './clinics/openingHours'

export const ClinicProfileDrafts: CollectionConfig = {
  slug: 'clinicProfileDrafts',
  admin: {
    hidden: true,
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['clinic', 'revision', 'basePublishedRevision', 'updatedAt'],
    description: 'Private clinic profile drafts managed through the Clinic Dashboard API',
  },
  access: {
    admin: () => false,
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
  },
  hooks: {
    beforeChange: [guardClinicProfileDraftWrite],
    beforeDelete: [
      async ({ id, req }) => {
        const stored = await req.payload.findByID({
          collection: 'clinicProfileDrafts',
          id,
          depth: 0,
          overrideAccess: true,
          req,
        })
        const target = relationId(stored.clinic)
        if (target === null) throw new APIError('The stored clinic profile draft owner is unavailable.', 403)
        await authorizeClinicProfileTarget(req, target, true)
      },
    ],
    afterOperation: [
      async ({ req, operation, result }) => {
        if (!['create', 'update', 'delete'].includes(operation)) return result
        requireNotificationTransaction(req, await req.transactionID)
        const records =
          result && typeof result === 'object' && 'docs' in result && Array.isArray(result.docs)
            ? result.docs
            : [result]
        for (const record of records) {
          const target = relationId(record && typeof record === 'object' && 'clinic' in record ? record.clinic : null)
          if (target === null) throw new APIError('The stored clinic profile draft owner is unavailable.', 403)
          await authorizeClinicProfileTarget(req, target, true)
        }
        return result
      },
    ],
  },
  indexes: [
    {
      fields: ['clinic'],
      unique: true,
    },
  ],
  fields: [
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
    },
    {
      name: 'basePublishedRevision',
      type: 'number',
      required: true,
      min: 0,
    },
    {
      name: 'revision',
      type: 'number',
      required: true,
      min: 1,
    },
    {
      name: 'name',
      type: 'text',
      maxLength: 180,
    },
    {
      name: 'description',
      type: 'richText',
    },
    {
      name: 'supportedLanguages',
      type: 'select',
      hasMany: true,
      options: languageOptions,
    },
    {
      name: 'address',
      type: 'group',
      fields: [
        {
          name: 'country',
          type: 'relationship',
          relationTo: 'countries',
          required: true,
        },
        {
          name: 'street',
          type: 'text',
          maxLength: 200,
        },
        {
          name: 'houseNumber',
          type: 'text',
          maxLength: 40,
        },
        {
          name: 'zipCode',
          type: 'text',
          maxLength: 32,
        },
        {
          name: 'city',
          type: 'relationship',
          relationTo: 'cities',
        },
      ],
    },
    draftOpeningHoursField,
  ],
}
