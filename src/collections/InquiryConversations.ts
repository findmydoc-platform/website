import type { CollectionConfig } from 'payload'

import { hiddenSystemTextField, immutableInquiryFields } from './inquiryCommunication/common'
import { validateInquiryConversation } from './inquiryCommunication/invariants'

export const InquiryConversations: CollectionConfig = {
  slug: 'inquiryConversations',
  labels: { singular: 'Inquiry Conversation', plural: 'Inquiry Conversations' },
  admin: {
    hidden: true,
    group: 'Platform Management',
    useAsTitle: 'id',
    defaultColumns: ['inquiry', 'clinic', 'patient', 'createdAt'],
    description: 'Private patient-clinic conversation bound to one inquiry',
  },
  access: {
    create: () => false,
    read: () => false,
    update: () => false,
    delete: () => false,
    admin: () => false,
  },
  endpoints: false,
  graphQL: false,
  hooks: {
    beforeValidate: [validateInquiryConversation],
    beforeChange: [immutableInquiryFields(['inquiry', 'clinic', 'patient', 'actorKey'])],
  },
  fields: [
    {
      name: 'inquiry',
      type: 'relationship',
      relationTo: 'patientClinicInquiries',
      required: true,
      unique: true,
      index: true,
    },
    { name: 'clinic', type: 'relationship', relationTo: 'clinics', required: true, index: true },
    { name: 'patient', type: 'relationship', relationTo: 'patients', index: true },
    hiddenSystemTextField('actorKey', { index: true, required: false }),
  ],
  timestamps: true,
  trash: true,
}
