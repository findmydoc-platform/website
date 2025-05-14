import { CollectionConfig } from 'payload'

/**
 * Reviews collection: Each review is written by a patient (PlattformStaff with role 'user'),
 * and can optionally target a clinic, doctor, and/or treatment. Only one of each per review.
 * Fields: reviewDate, starRating, comment, status, patient, clinic, doctor, treatment.
 * - reviewDate: required, date of review
 * - starRating: required, integer 1-5
 * - comment: required, text
 * - status: select, default 'pending', options: pending, approved, rejected
 * - patient: required, relationship to PlattformStaff (role 'user')
 * - clinic: optional, relationship to Clinics
 * - doctor: optional, relationship to Doctors
 * - treatment: optional, relationship to Treatments
 * Only one target per review is allowed for each relationship.
 */

export const Reviews: CollectionConfig = {
  slug: 'review',
  admin: {
    group: 'Platform Management',
    useAsTitle: 'comment',
    defaultColumns: [
      'reviewDate',
      'starRating',
      'patient',
      'clinic',
      'doctor',
      'treatment',
      'status',
      'createdAt',
    ],
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'reviewDate',
      type: 'date',
      required: true,
      admin: {
        description: 'Date the review was written',
      },
    },
    {
      name: 'starRating',
      type: 'number',
      required: true,
      min: 1,
      max: 5,
      admin: {
        description: 'Star rating from 1 to 5',
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
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      options: [
        { label: 'Pending', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: {
        description: 'Review status',
      },
    },
    {
      name: 'patient',
      type: 'relationship',
      relationTo: 'plattformStaff',
      required: true,
      admin: {
        description: 'Patient who wrote this review (PlattformStaff with role user)',
      },
    },
    {
      name: 'clinic',
      type: 'relationship',
      relationTo: 'clinics',
      required: false,
      admin: {
        description: 'Clinic being reviewed (optional)',
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
      name: 'treatment',
      type: 'relationship',
      relationTo: 'treatments',
      required: false,
      admin: {
        description: 'Treatment being reviewed (optional)',
      },
    },
  ],
  timestamps: true,
}
