import type { CollectionConfig, Field } from 'payload'

import { computedOnlyFieldAccess, platformOnlyFieldAccess, staffProfileFieldReadAccess } from '@/access/fieldAccess'
import {
  platformOrAssignedClinicMutation,
  platformOrOwnClinicResource,
  platformOrOwnClinicReviewWorkflowVersions,
} from '@/access/scopeFilters'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import { prepareReviewAppealChange, preventReviewWorkflowVersionRestore } from '@/collections/reviewWorkflow'

const auditFields: Field[] = [
  {
    name: 'lastAction',
    type: 'select',
    required: true,
    options: [
      { label: 'Submitted', value: 'submitted' },
      { label: 'Reviewed without transition', value: 'reviewed' },
      { label: 'Under review', value: 'under_review' },
      { label: 'Upheld', value: 'upheld' },
      { label: 'Dismissed', value: 'dismissed' },
      { label: 'Seeded', value: 'seeded' },
    ],
    access: {
      create: computedOnlyFieldAccess,
      read: staffProfileFieldReadAccess,
      update: computedOnlyFieldAccess,
    },
    admin: { readOnly: true },
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
    admin: { readOnly: true },
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
    admin: { readOnly: true },
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

export const ReviewAppeals: CollectionConfig = {
  slug: 'reviewAppeals',
  admin: {
    group: 'Platform Management',
    useAsTitle: 'review',
    defaultColumns: ['review', 'clinic', 'reason', 'status', 'lastActionAt', 'updatedAt'],
    description: 'Clinic appeals against approved patient reviews. Appeals are never public.',
  },
  access: {
    create: platformOrAssignedClinicMutation,
    read: platformOrOwnClinicResource,
    readVersions: platformOrOwnClinicReviewWorkflowVersions,
    update: ({ req }) => isPlatformStaff({ req }),
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
        description: 'Approved review that can have exactly one appeal for its entire lifetime.',
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
      name: 'reason',
      type: 'select',
      required: true,
      options: [
        { label: 'Incorrect clinic', value: 'incorrect_clinic' },
        { label: 'Inappropriate content', value: 'inappropriate_content' },
        { label: 'Privacy concern', value: 'privacy_concern' },
        { label: 'Other', value: 'other' },
      ],
    },
    {
      name: 'details',
      type: 'textarea',
      required: true,
      minLength: 10,
      maxLength: 2000,
      admin: {
        description: '10–2000 characters. The submitted appeal cannot be changed by clinic staff.',
      },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'submitted',
      index: true,
      options: [
        { label: 'Submitted', value: 'submitted' },
        { label: 'Under review', value: 'under_review' },
        { label: 'Upheld', value: 'upheld' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      access: {
        create: platformOnlyFieldAccess,
        update: platformOnlyFieldAccess,
      },
      admin: {
        description: 'Only platform staff can move an appeal through its lifecycle.',
      },
    },
    {
      name: 'decisionReason',
      type: 'textarea',
      minLength: 10,
      maxLength: 2000,
      access: {
        create: platformOnlyFieldAccess,
        update: platformOnlyFieldAccess,
      },
      admin: {
        description: 'Required when the appeal is upheld or dismissed.',
      },
    },
    {
      name: 'decidedAt',
      type: 'date',
      access: {
        create: computedOnlyFieldAccess,
        update: computedOnlyFieldAccess,
      },
      admin: { readOnly: true },
    },
    ...auditFields,
  ],
  hooks: {
    beforeChange: [stableIdBeforeChangeHook, prepareReviewAppealChange],
    beforeOperation: [preventReviewWorkflowVersionRestore],
  },
  timestamps: true,
}
