import { CollectionConfig } from 'payload'
import { isPatient } from '@/access/isPatient'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { platformOnlyFieldAccess } from '@/access/fieldAccess'
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
    defaultColumns: ['reviewDate', 'starRating', 'patient', 'clinic', 'doctor', 'treatment', 'status', 'createdAt'],
    description: 'Feedback from patients about clinics, doctors and treatments',
  },
  access: {
    read: platformOnlyOrApprovedReviews, // Platform Staff: all reviews, Others: approved only
    create: ({ req }) => isPatient({ req }) || isPlatformBasicUser({ req }),
    update: ({ req }) => {
      // Platform Staff: Full access for moderation
      if (isPlatformBasicUser({ req })) return true

      // Patients: Only own reviews
      if (isPatient({ req }) && req.user) {
        return {
          patient: { equals: req.user.id },
        }
      }

      // Clinic Staff: No update access (read only)
      return false
    },
    delete: ({ req }) => {
      // Platform Staff: Full access for moderation
      if (isPlatformBasicUser({ req })) return true

      // Patients: Only own reviews
      if (isPatient({ req }) && req.user) {
        return {
          patient: { equals: req.user.id },
        }
      }

      // Clinic Staff: No 'delete' access
      return false
    },
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
              access: {
                // Only Platform Staff can create/update review status (moderation)
                create: platformOnlyFieldAccess,
                update: platformOnlyFieldAccess,
              },
              admin: {
                description: 'Review moderation status - only Platform Staff can change this',
                width: '50%',
                condition: (data, siblingData, { user }) => {
                  // Hide status field from non-platform users in admin UI
                  return Boolean(user && user.collection === 'basicUsers' && user.userType === 'platform')
                },
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
  ],
  hooks: {
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
          !(operation === 'update' && originalDoc && existing.docs[0] && existing.docs[0].id === originalDoc.id)
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
