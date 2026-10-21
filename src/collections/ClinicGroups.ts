import { personalGroupInvitationEndpoint } from '@/auth/actions/personalGroupInvitation'
import { normalizeNativeFinalWriteOperation } from '@/access/nativeFinalOperation'
import type { CollectionConfig } from 'payload'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import {
  guardClinicGroupOperation,
  guardClinicGroupWrite,
  rejectReferencedClinicGroupDeletion,
} from '@/features/clinicGroups/hooks'
import { guardNotificationAuthorizationSession } from '@/features/clinicNotifications/authorizationBarrier'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

export const ClinicGroups: CollectionConfig = {
  slug: 'clinicGroups',
  labels: { singular: 'Clinic Group', plural: 'Clinic Groups' },
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    description: 'Private clinic groups managed by authorized findmydoc operators.',
  },
  access: {
    admin: async ({ req }) => (await platformClinicTrustAccess({ req })) === true,
    create: platformClinicTrustAccess,
    read: platformClinicTrustAccess,
    update: platformClinicTrustAccess,
    delete: platformClinicTrustAccess,
  },
  endpoints: [personalGroupInvitationEndpoint],
  hooks: {
    beforeOperation: [guardClinicGroupOperation],
    beforeChange: [guardClinicGroupWrite, stableIdBeforeChangeHook],
    beforeDelete: [rejectReferencedClinicGroupDeletion],
    afterOperation: [
      async ({ result, operation, req }) => {
        if (normalizeNativeFinalWriteOperation(operation)) await guardNotificationAuthorizationSession({ req })
        return result
      },
    ],
  },
  fields: [
    stableIdField(),
    {
      name: 'personalInvitation',
      type: 'ui',
      admin: { components: { Field: '@/app/(payload)/components/PersonalGroupInvitation#PersonalGroupInvitation' } },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      maxLength: 200,
      admin: { description: 'Name used to identify this clinic group in the back office.' },
    },
  ],
  timestamps: true,
}
