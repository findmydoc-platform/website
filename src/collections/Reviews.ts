import { CollectionConfig } from 'payload'
import { isPatient } from '@/access/isPatient'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { platformOnlyOrApprovedReviews } from '@/access/scopeFilters'
import {
  updateAverageRatingsAfterChange,
  updateAverageRatingsAfterDelete,
} from '@/hooks/calculations/updateAverageRatings'

export const Reviews: CollectionConfig = {
  slug: 'reviews',
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
    description: 'Feedback from patients about clinics, doctors and treatments',
  },
  access: {
    read: ({ req }) => {
      return platformOnlyOrApprovedReviews({ req })
    },
    create: ({ req }) => isPatient({ req }) || isPlatformBasicUser({ req }),
    update: ({ req }) => {
      // Only Platform Staff can edit reviews for quality control and moderation
      // Patients must contact support for any review modifications
      return isPlatformBasicUser({ req })
    },
    delete: ({ req }) => isPlatformBasicUser({ req }),
  },
  fields: [
    {
      name: 'reviewDate',
      type: 'date',
      required: true,
      admin: {
        description: 'Date the review was written (set automatically on create)',
        readOnly: true,
      },
      hooks: {
        beforeChange: [
          ({ operation, value }) => {
            // Set reviewDate automatically on create
            if (operation === 'create') {
              return new Date().toISOString()
            }
            return value
          },
        ],
      },
    },
    {
      type: 'collapsible',
      label: 'Review & Patient',
      admin: {
        initCollapsed: false,
      },
      fields: [
        {
          type: 'row',
          fields: [
            {
              name: 'patient',
              type: 'relationship',
              relationTo: 'platformStaff',
              required: true,
              admin: {
                description: 'Patient who wrote this review (PlatformStaff with role user)',
                width: '50%',
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
                width: '50%',
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
          ],
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Review Context',
      admin: {
        initCollapsed: true,
      },
      fields: [
        {
          name: 'clinic',
          type: 'relationship',
          relationTo: 'clinics',
          required: true,
          admin: {
            description: 'Clinic being reviewed (required)',
          },
        },
        {
          name: 'doctor',
          type: 'relationship',
          relationTo: 'doctors',
          required: true,
          admin: {
            description: 'Doctor being reviewed (required)',
          },
        },
        {
          name: 'treatment',
          type: 'relationship',
          relationTo: 'treatments',
          required: true,
          admin: {
            description: 'Treatment being reviewed (required)',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Review Audit Trail',
      admin: {
        initCollapsed: true,
        description: 'Tracking information for review edits and moderation',
      },
      fields: [
        {
          name: 'lastEditedAt',
          type: 'date',
          admin: {
            description: 'Timestamp of last review modification',
            readOnly: true,
          },
        },
        {
          name: 'editedBy',
          type: 'relationship',
          relationTo: 'basicUsers',
          admin: {
            description: 'Platform Staff member who last edited this review',
            readOnly: true,
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      async ({ data, req, operation, originalDoc }) => {
        // Platform Staff can edit reviews for moderation purposes
        // Patients cannot directly edit reviews - they must contact support
        
        // Audit logging for Platform Staff edits
        if (operation === 'update' && originalDoc && req.user) {
          if (isPlatformBasicUser({ req })) {
            if (process.env.NODE_ENV !== 'production') {
              req.payload.logger.info(
                `Platform Staff ${req.user.id} modified review ${originalDoc.id} (Patient: ${originalDoc.patient})`
              )
            }
            
            // Add edit timestamp for audit trail
            data.lastEditedAt = new Date().toISOString()
            data.editedBy = req.user.id
          }
        }
        
        return data
      },
    ],
    beforeValidate: [
      async ({ data, req, operation, originalDoc, collection }) => {
        // Defensive: If data is missing, skip validation (Payload may call with undefined data in some edge cases)
        if (!data) return data

        // MVP: Require all three relationships for a review
        // TODO: Make this configurable in the future when we have also bookings
        if (!data.clinic || !data.doctor || !data.treatment) {
          throw new Error('A review must be linked to a clinic, doctor, and treatment.')
        }

        // Prevent duplicate reviews for the same patient+clinic+doctor+treatment
        const query: any = {
          patient: data.patient,
          clinic: data.clinic,
          doctor: data.doctor,
          treatment: data.treatment,
        }

        const existing = await req.payload.find({
          collection: collection.slug,
          where: query,
          limit: 1,
        })

        if (
          existing &&
          Array.isArray(existing.docs) &&
          existing.docs.length > 0 &&
          !(
            operation === 'update' &&
            originalDoc &&
            existing.docs[0] &&
            existing.docs[0].id === originalDoc.id
          )
        ) {
          throw new Error(
            'Duplicate review: this patient has already reviewed this treatment with this doctor at this clinic.',
          )
        }

        return data
      },
    ],
    afterChange: [updateAverageRatingsAfterChange],
    afterDelete: [updateAverageRatingsAfterDelete],
  },
  timestamps: true,
}
