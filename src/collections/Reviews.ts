import { CollectionConfig } from 'payload'

export const Reviews: CollectionConfig = {
  slug: 'review',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'rating', 'user', 'createdAt'],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      admin: {
        description: 'Brief title for the review',
      },
    },
    {
      name: 'user',
      type: 'relationship',
      relationTo: 'plattformStaff',
      required: true,
      admin: {
        description: 'User who wrote this review',
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: true,
      admin: {
        description: 'Clinic being reviewed',
      },
    },
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      required: false,
      admin: {
        description: 'Doctor being reviewed (optional)',
      },
    },
    {
      name: 'rating',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      admin: {
        description: 'Rating from 1-5 stars',
      },
    },
    {
      name: 'comment',
      type: 'textarea',
      required: true,
      admin: {
        description: 'Review text/comments',
      },
    },
    {
      name: 'verified', // just an idea
      type: 'checkbox',
      defaultValue: false,
      admin: {
        description: 'Indicates if this review is from a verified patient',
      },
    },
  ],
  timestamps: true,
}
