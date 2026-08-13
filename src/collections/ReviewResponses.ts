import type { CollectionConfig, Field } from 'payload'

import {
  clinicOnlyFieldAccess,
  computedOnlyFieldAccess,
  platformOnlyFieldAccess,
  staffProfileFieldReadAccess,
} from '@/access/fieldAccess'
import {
  assignedClinicMutation,
  platformClinicOrPublicReviewResponse,
  platformOrOwnClinicResource,
  platformOrOwnClinicReviewWorkflowVersions,
} from '@/access/scopeFilters'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import {
  hideEmptyReviewResponseGroups,
  prepareReviewResponseChange,
  preventReviewWorkflowVersionRestore,
} from '@/collections/reviewWorkflow'
import { revalidateReviewResponseChange } from '@/hooks/revalidateClinicSurfaces'

const auditFields: Field[] = [
  {
    name: 'lastAction',
    type: 'select',
    required: true,
    options: [
      { label: 'Submitted', value: 'submitted' },
      { label: 'Pending response edited', value: 'pending_edited' },
      { label: 'Revision submitted', value: 'revision_submitted' },
      { label: 'Approved', value: 'approved' },
      { label: 'Rejected', value: 'rejected' },
      { label: 'Blocked', value: 'blocked' },
      { label: 'Seeded', value: 'seeded' },
    ],
    access: {
      create: computedOnlyFieldAccess,
      read: staffProfileFieldReadAccess,
      update: computedOnlyFieldAccess,
    },
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'lastActionAt',
    type: 'date',
    required: true,
    access: {
      create: computedOnlyFieldAccess,
      read: staffProfileFieldReadAccess,
      update: computedOnlyFieldAccess,
    },
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'lastActorType',
    type: 'select',
    required: true,
    options: [
      { label: 'Clinic staff', value: 'clinic_staff' },
      { label: 'Platform staff', value: 'platform_staff' },
      { label: 'System', value: 'system' },
    ],
    access: {
      create: computedOnlyFieldAccess,
      read: staffProfileFieldReadAccess,
      update: computedOnlyFieldAccess,
    },
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'lastActionBy',
    type: 'relationship',
    relationTo: ['platformStaff', 'clinicStaff'],
    access: {
      create: computedOnlyFieldAccess,
      read: staffProfileFieldReadAccess,
      update: computedOnlyFieldAccess,
    },
    admin: {
      description:
        'Internal actor relation. Account erasure removes this relation while the non-personal action audit remains.',
      readOnly: true,
    },
  },
]

export const ReviewResponses: CollectionConfig = {
  slug: 'reviewResponses',
  admin: {
    group: 'Platform Management',
    useAsTitle: 'review',
    defaultColumns: ['review', 'clinic', 'moderationStatus', 'lastActionAt', 'updatedAt'],
    description: 'Moderated clinic responses. The approved response remains public while a replacement is pending.',
  },
  access: {
    create: assignedClinicMutation,
    read: platformClinicOrPublicReviewResponse,
    readVersions: platformOrOwnClinicReviewWorkflowVersions,
    update: platformOrOwnClinicResource,
    delete: () => false,
  },
  disableDuplicate: true,
  disableBulkDelete: true,
  versions: {
    maxPerDoc: 0,
  },
  fields: [
    stableIdField(),
    {
      name: 'review',
      type: 'relationship',
      relationTo: 'reviews',
      required: true,
      unique: true,
      index: true,
      admin: {
        description: 'Approved review that receives exactly one clinic response workflow.',
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      index: true,
      admin: {
        description: 'Derived from the review and immutable.',
        readOnly: true,
      },
    },
    {
      name: 'publishedResponse',
      type: 'group',
      access: {
        create: platformOnlyFieldAccess,
        update: platformOnlyFieldAccess,
      },
      admin: {
        description: 'Current public response projection. Platform moderation controls this group.',
      },
      fields: [
        {
          name: 'body',
          type: 'textarea',
          minLength: 10,
          maxLength: 2000,
        },
        {
          name: 'approvedAt',
          type: 'date',
          admin: {
            readOnly: true,
          },
        },
        {
          name: 'isBlocked',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            readOnly: true,
          },
        },
      ],
    },
    {
      name: 'pendingResponse',
      type: 'group',
      label: 'Current clinic submission',
      access: {
        create: clinicOnlyFieldAccess,
        read: staffProfileFieldReadAccess,
        update: clinicOnlyFieldAccess,
      },
      admin: {
        description:
          'Submitted by the clinic. Use the moderation status to approve or reject it; this text cannot be edited.',
        readOnly: true,
      },
      fields: [
        {
          name: 'body',
          type: 'textarea',
          minLength: 10,
          maxLength: 2000,
          admin: {
            description: '10–2000 characters. Outer whitespace is removed before validation.',
          },
        },
        {
          name: 'submittedAt',
          type: 'date',
          access: {
            create: computedOnlyFieldAccess,
            update: computedOnlyFieldAccess,
          },
          admin: {
            readOnly: true,
          },
        },
      ],
    },
    {
      name: 'moderationStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
        { label: 'Blocked', value: 'blocked' },
      ],
      access: {
        create: platformOnlyFieldAccess,
        read: staffProfileFieldReadAccess,
        update: platformOnlyFieldAccess,
      },
      admin: {
        description:
          'Approved replaces the public response. Rejected keeps the previous response. Blocked removes it from public output.',
      },
    },
    {
      name: 'moderationReason',
      type: 'textarea',
      minLength: 10,
      maxLength: 2000,
      access: {
        create: platformOnlyFieldAccess,
        read: staffProfileFieldReadAccess,
        update: platformOnlyFieldAccess,
      },
      admin: {
        description: 'Required when a response is rejected or blocked.',
      },
    },
    {
      name: 'moderatedAt',
      type: 'date',
      access: {
        create: computedOnlyFieldAccess,
        read: staffProfileFieldReadAccess,
        update: computedOnlyFieldAccess,
      },
      admin: {
        readOnly: true,
      },
    },
    ...auditFields,
  ],
  hooks: {
    beforeChange: [stableIdBeforeChangeHook, prepareReviewResponseChange],
    beforeOperation: [preventReviewWorkflowVersionRestore],
    afterChange: [revalidateReviewResponseChange],
    afterRead: [hideEmptyReviewResponseGroups],
  },
  timestamps: true,
}
