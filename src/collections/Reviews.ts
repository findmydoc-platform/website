import type { CollectionConfig, PayloadRequest, Where } from 'payload'
import { isPatient } from '@/access/isPatient'
import { platformOnlyFieldAccess } from '@/access/fieldAccess'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { platformOnlyOrApprovedReviews } from '@/access/scopeFilters'
import {
  updateAverageRatingsAfterChange,
  updateAverageRatingsAfterDelete,
} from '@/hooks/calculations/updateAverageRatings'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import { getCurrentIsoTimestampString } from '@/utilities/timestamps'

type ReviewDraft = Record<string, unknown>
type RelationId = string | number

function extractRelationId(value: unknown): RelationId | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.length > 0) return value

  if (value && typeof value === 'object' && 'id' in value) {
    const relation = value as { id?: unknown }
    return extractRelationId(relation.id)
  }

  return null
}

function getRequestUserId(req: { user?: unknown }): RelationId | null {
  if (!req.user || typeof req.user !== 'object' || !('id' in req.user)) return null
  return extractRelationId((req.user as { id?: unknown }).id)
}

function isPatientRequest(req: { user?: unknown }): boolean {
  return Boolean(
    req.user &&
    typeof req.user === 'object' &&
    'collection' in req.user &&
    (req.user as { collection?: unknown }).collection === 'patients',
  )
}

function isPlatformStaffRequest(req: { user?: unknown }): boolean {
  return Boolean(
    req.user &&
    typeof req.user === 'object' &&
    'collection' in req.user &&
    'userType' in req.user &&
    (req.user as { collection?: unknown; userType?: unknown }).collection === 'basicUsers' &&
    (req.user as { collection?: unknown; userType?: unknown }).userType === 'platform',
  )
}

function formatPublicAuthorName(patient: unknown): string | null {
  if (!patient || typeof patient !== 'object') return null

  const record = patient as { firstName?: unknown; lastName?: unknown }
  const firstName = typeof record.firstName === 'string' ? record.firstName.trim() : ''
  const lastName = typeof record.lastName === 'string' ? record.lastName.trim() : ''
  const lastInitial = lastName.length > 0 ? `${lastName.charAt(0).toUpperCase()}.` : ''
  const name = [firstName, lastInitial].filter(Boolean).join(' ')

  return name.length > 0 ? name : null
}

async function resolvePublicAuthorName(options: {
  req: PayloadRequest
  patientId: RelationId | null
}): Promise<string | null> {
  const { req, patientId } = options
  if (patientId == null) return null

  try {
    const patient = await req.payload.findByID({
      collection: 'patients',
      id: patientId,
      depth: 0,
      overrideAccess: true,
      req,
    })

    return formatPublicAuthorName(patient)
  } catch {
    return null
  }
}

function forcePatientCreateModeration(data: ReviewDraft, req: { user?: unknown }, operation: 'create' | 'update') {
  if (operation !== 'create' || !isPatientRequest(req)) return

  const patientId = getRequestUserId(req)
  if (patientId == null) {
    throw new Error('Authenticated patient review creation requires a patient user id.')
  }

  data.patient = patientId
  data.status = 'pending'
  delete data.publicAuthorName
  delete data.lastEditedAt
  delete data.editedByName
  delete data.editedBy
}

function readRelationshipId(data: ReviewDraft, originalDoc: unknown, field: string): RelationId | null {
  const draftValue = extractRelationId(data[field])
  if (draftValue != null) return draftValue

  if (!originalDoc || typeof originalDoc !== 'object') return null
  return extractRelationId((originalDoc as Record<string, unknown>)[field])
}

export const Reviews: CollectionConfig = {
  slug: 'reviews',
  admin: {
    group: 'Platform Management',
    useAsTitle: 'comment',
    defaultColumns: [
      'reviewDate',
      'starRating',
      'patient',
      'authorVisibility',
      'clinic',
      'doctor',
      'treatment',
      'status',
      'createdAt',
    ],
    description: 'Patient reviews for clinics, doctors, and treatments',
  },
  access: {
    read: ({ req }) => {
      return platformOnlyOrApprovedReviews({ req })
    },
    create: ({ req }) => isPatient({ req }) || isPlatformBasicUser({ req }),
    update: ({ req }) => {
      // Only Platform Staff can edit reviews for quality control and moderation
      // Patients must contact support for review modifications
      return isPlatformBasicUser({ req })
    },
    delete: ({ req }) => isPlatformBasicUser({ req }),
  },
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    stableIdField(),
    {
      name: 'reviewDate',
      type: 'date',
      required: true,
      defaultValue: getCurrentIsoTimestampString,
      admin: {
        description: 'Date the review was written',
        readOnly: true,
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
              relationTo: 'patients',
              access: {
                read: ({ req }) => isPlatformStaffRequest(req),
              },
              admin: {
                description: 'Patient who wrote this review',
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
                description: 'Review approval status',
                width: '50%',
              },
            },
            {
              name: 'authorVisibility',
              type: 'select',
              required: true,
              defaultValue: 'anonymous',
              options: [
                { label: 'Anonymous', value: 'anonymous' },
                { label: 'First name + last initial', value: 'firstNameInitial' },
              ],
              admin: {
                description: 'Public author display preference',
                width: '50%',
              },
            },
            {
              name: 'publicAuthorName',
              type: 'text',
              admin: {
                description: 'Public author name snapshot shown only when the patient opted in',
                readOnly: true,
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
                description: 'Rating from 1 to 5',
              },
            },
            {
              name: 'comment',
              type: 'textarea',
              required: true,
              admin: {
                description: 'Review text',
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
            description: 'Clinic being reviewed',
          },
        },
        {
          name: 'doctor',
          type: 'relationship',
          relationTo: 'doctors',
          required: true,
          admin: {
            description: 'Doctor being reviewed',
          },
        },
        {
          name: 'treatment',
          type: 'relationship',
          relationTo: 'treatments',
          required: true,
          admin: {
            description: 'Treatment being reviewed',
          },
        },
      ],
    },
    {
      type: 'collapsible',
      label: 'Recent edits',
      admin: {
        initCollapsed: true,
        description: 'Last edits to this review',
      },
      fields: [
        {
          name: 'lastEditedAt',
          type: 'date',
          access: {
            create: platformOnlyFieldAccess,
            update: platformOnlyFieldAccess,
          },
          admin: {
            description: 'When this review was last edited',
            readOnly: true,
          },
        },
        {
          name: 'editedByName',
          type: 'text',
          label: 'Editor name',
          access: {
            create: platformOnlyFieldAccess,
            update: platformOnlyFieldAccess,
          },
          admin: {
            description: 'Name of the person who edited this review',
            readOnly: true,
          },
        },
        {
          name: 'editedBy',
          type: 'relationship',
          relationTo: 'basicUsers',
          label: 'Edited by',
          access: {
            create: platformOnlyFieldAccess,
            update: platformOnlyFieldAccess,
          },
          admin: {
            description: 'User who last edited this review',
            readOnly: true,
          },
        },
      ],
    },
  ],
  hooks: {
    beforeChange: [
      stableIdBeforeChangeHook,
      async ({ data, req, operation, originalDoc }) => {
        const draft = data as ReviewDraft

        forcePatientCreateModeration(draft, req, operation)

        const authorVisibility =
          typeof draft.authorVisibility === 'string'
            ? draft.authorVisibility
            : originalDoc && typeof originalDoc === 'object'
              ? (originalDoc as Record<string, unknown>).authorVisibility
              : 'anonymous'

        if (authorVisibility === 'firstNameInitial') {
          const patientId = readRelationshipId(draft, originalDoc, 'patient')
          draft.publicAuthorName = await resolvePublicAuthorName({ req, patientId })
        } else {
          draft.publicAuthorName = null
        }

        // Audit logging for Platform Staff edits
        if (operation === 'update' && originalDoc && req.user) {
          if (isPlatformBasicUser({ req })) {
            if (process.env.NODE_ENV !== 'production') {
              req.payload.logger.info(
                `Platform Staff ${req.user.id} modified review ${originalDoc.id} (Patient: ${originalDoc.patient})`,
              )
            }

            // Add edit timestamp for audit trail
            data.lastEditedAt = getCurrentIsoTimestampString()
            data.editedBy = req.user.id

            // Populate the name from the current user session without using `any`
            const userData = req.user as unknown as Record<string, unknown>
            const firstName = typeof userData.firstName === 'string' ? userData.firstName : ''
            const lastName = typeof userData.lastName === 'string' ? userData.lastName : ''
            const email = typeof userData.email === 'string' ? userData.email : ''

            const fullName = [firstName, lastName].filter(Boolean).join(' ')
            data.editedByName = fullName || email || 'Unknown'
          }
        }

        return draft
      },
    ],
    beforeValidate: [
      async ({ data, req, operation, originalDoc, collection }) => {
        // Defensive: If data is missing, skip validation (Payload may call with undefined data in some edge cases)
        if (!data) return data

        const draft = data as ReviewDraft
        forcePatientCreateModeration(draft, req, operation)

        const patientId = readRelationshipId(draft, originalDoc, 'patient')
        const clinicId = readRelationshipId(draft, originalDoc, 'clinic')
        const doctorId = readRelationshipId(draft, originalDoc, 'doctor')
        const treatmentId = readRelationshipId(draft, originalDoc, 'treatment')

        if (!clinicId || !doctorId || !treatmentId) {
          throw new Error('A review must be linked to a clinic, doctor, and treatment.')
        }

        if (operation === 'create' && !patientId) {
          throw new Error('A review must be linked to a patient when it is created.')
        }

        if (!patientId) {
          return data
        }

        // Prevent duplicate reviews for the same patient+clinic+doctor+treatment
        const query: Where = {
          patient: { equals: patientId },
          clinic: { equals: clinicId },
          doctor: { equals: doctorId },
          treatment: { equals: treatmentId },
        }

        const existing = await req.payload.find({
          collection: collection.slug,
          where: query,
          depth: 0,
          limit: 1,
          trash: true,
          overrideAccess: true,
          req,
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
  indexes: [
    {
      fields: ['patient', 'clinic', 'doctor', 'treatment'],
      unique: true,
    },
  ],
}
