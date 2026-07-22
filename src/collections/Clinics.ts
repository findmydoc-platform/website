import type { Clinic } from '@/payload-types'
import type { CollectionBeforeChangeHook, CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { slugField, ValidationError, validations } from 'payload'
import { clinicContactRoleOptions, languageOptions } from './common/selectionOptions'
import { createConditionalRequiredValidator, toValidationFieldErrors } from './common/conditionalRequirements'
import {
  CLINIC_APPROVAL_MARKER,
  clinicApprovalRequirements,
  clinicApprovalRequirementSet,
  getMissingClinicApprovalRequirements,
} from './clinics/approvalRequirements'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { disabledClinicGalleryAccess } from '@/access/clinicGallery'
import { platformOrOwnClinicProfile, platformOnlyOrApproved } from '@/access/scopeFilters'
import {
  computedOnlyFieldAccess,
  platformClinicTrustAccess,
  platformClinicTrustFieldAccess,
} from '@/access/fieldAccess'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'
import { revalidateClinicChange, revalidateClinicDelete } from '@/hooks/revalidateClinicSurfaces'
import { beforeChangeImmutableField } from '@/hooks/immutability'

const GALLERY_ENTRIES_SAME_CLINIC_MESSAGE = 'Gallery entries must belong to this clinic.'
const CLINIC_APPROVAL_ERROR_COMPONENT =
  '@/app/(payload)/components/ClinicApprovalRequirements#ClinicApprovalRequirementError'

const getRelationshipId = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value

  if (typeof value === 'string') {
    const numericId = Number(value)
    return Number.isSafeInteger(numericId) ? numericId : null
  }

  if (value && typeof value === 'object' && 'id' in value) {
    return getRelationshipId((value as { id?: unknown }).id)
  }

  return null
}

const validateApprovedClinicCompleteness: CollectionBeforeChangeHook<Clinic> = ({ data, originalDoc, req }) => {
  const missingRequirements = getMissingClinicApprovalRequirements(data, originalDoc)

  if (missingRequirements.length > 0) {
    throw new ValidationError({
      collection: 'clinics',
      errors: toValidationFieldErrors(missingRequirements),
      id: originalDoc?.id,
      req,
    })
  }

  return data
}

const validateGalleryEntriesBeforeValidate: CollectionBeforeValidateHook<Clinic> = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data || !Object.prototype.hasOwnProperty.call(data, 'galleryEntries')) return data

  const incomingEntries = data.galleryEntries
  if (incomingEntries === null || incomingEntries === undefined || incomingEntries.length === 0) return data

  const clinicId = getRelationshipId(originalDoc?.id)
  const entryIds = Array.from(new Set(incomingEntries.map(getRelationshipId)))

  if (!clinicId || entryIds.some((id) => id === null)) {
    throw new Error(GALLERY_ENTRIES_SAME_CLINIC_MESSAGE)
  }

  const normalizedEntryIds = entryIds as number[]
  const entries = await req.payload.find({
    collection: 'clinicGalleryEntries',
    depth: 0,
    limit: normalizedEntryIds.length,
    pagination: false,
    overrideAccess: true,
    req,
    select: {
      id: true,
      clinic: true,
    },
    where: {
      id: {
        in: normalizedEntryIds,
      },
    },
  })

  const validEntryIds = new Set(
    entries.docs
      .filter((entry) => getRelationshipId(entry.clinic) === clinicId)
      .map((entry) => getRelationshipId(entry.id)),
  )

  if (normalizedEntryIds.some((id) => !validEntryIds.has(id))) {
    throw new Error(GALLERY_ENTRIES_SAME_CLINIC_MESSAGE)
  }

  return data
}

export const Clinics: CollectionConfig<'clinics'> = {
  slug: 'clinics',
  // This config controls what's populated by default when a clinic is referenced
  // via relationship fields or join results.
  defaultPopulate: {
    name: true,
    slug: true,
    averageRating: true,
    verification: true,
    address: {
      city: true,
      country: true,
    },
    thumbnail: true,
  },
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'country'],
    description: 'Clinic profiles with address, contact details, and services',
  },
  access: {
    read: platformOnlyOrApproved, // Platform Staff: all clinics, Others: approved only
    create: platformClinicTrustAccess, // Only Platform admin/support can create clinics
    update: platformOrOwnClinicProfile, // Platform: all clinics, Clinic: only own profile
    delete: isPlatformStaff, // Only Platform can delete clinics
  },
  hooks: {
    beforeValidate: [validateGalleryEntriesBeforeValidate],
    beforeChange: [
      stableIdBeforeChangeHook,
      beforeChangeImmutableField({ field: 'onboardingKey', message: 'onboardingKey cannot be changed once set' }),
      validateApprovedClinicCompleteness,
    ],
    afterChange: [revalidateClinicChange],
    afterDelete: [revalidateClinicDelete],
  },
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    stableIdField(),
    {
      name: 'onboardingKey',
      type: 'text',
      index: true,
      access: {
        create: () => false,
        read: () => false,
        update: () => false,
      },
      admin: {
        hidden: true,
        disableListColumn: true,
      },
    },
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Clinic name shown to patients',
      },
    },
    {
      name: 'averageRating',
      type: 'number',
      min: 0,
      max: 5,
      access: {
        create: computedOnlyFieldAccess,
        update: computedOnlyFieldAccess,
      },
      admin: {
        description: 'Average patient rating',
        readOnly: true,
        position: 'sidebar',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
          fields: [
            {
              name: 'description',
              type: 'richText',
              admin: {
                description: 'Clinic overview shown to patients',
              },
            },
            {
              name: 'tags',
              type: 'relationship',
              relationTo: 'tags',
              hasMany: true,
              admin: {
                description: 'Tags for this clinic',
              },
            },
            {
              name: 'treatments',
              type: 'join',
              collection: 'clinictreatments',
              on: 'clinic',
              admin: {
                defaultColumns: ['treatment', 'price'],
                description: 'Treatments this clinic offers',
                allowCreate: true,
              },
            },
            {
              name: 'thumbnail',
              type: 'upload',
              relationTo: 'clinicMedia',
              admin: {
                description: 'Main image shown on the clinic profile',
              },
            },
            {
              name: 'galleryEntries',
              type: 'relationship',
              relationTo: 'clinicGalleryEntries',
              hasMany: true,
              access: {
                create: disabledClinicGalleryAccess,
                read: disabledClinicGalleryAccess,
                update: disabledClinicGalleryAccess,
              },
              admin: {
                hidden: true,
                description: 'Before-and-after stories shown on the clinic profile',
              },
            },
          ],
        },
        {
          label: 'Address',
          fields: [
            {
              name: 'coordinates',
              type: 'point',
              admin: {
                description: 'Clinic location for maps',
              },
            },
            {
              name: 'address',
              type: 'group',
              admin: {
                description: 'Clinic address',
              },
              fields: [
                {
                  name: 'country',
                  type: 'text',
                  admin: {
                    components: {
                      Error: CLINIC_APPROVAL_ERROR_COMPONENT,
                    },
                    description: `Country where the clinic is located. ${CLINIC_APPROVAL_MARKER}.`,
                  },
                  validate: createConditionalRequiredValidator(
                    validations.text,
                    clinicApprovalRequirementSet,
                    clinicApprovalRequirements.country,
                  ),
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'street',
                      type: 'text',
                      admin: {
                        components: {
                          Error: CLINIC_APPROVAL_ERROR_COMPONENT,
                        },
                        description: `Street name. ${CLINIC_APPROVAL_MARKER}.`,
                        width: '70%',
                      },
                      validate: createConditionalRequiredValidator(
                        validations.text,
                        clinicApprovalRequirementSet,
                        clinicApprovalRequirements.street,
                      ),
                    },
                    {
                      name: 'houseNumber',
                      type: 'text',
                      admin: {
                        components: {
                          Error: CLINIC_APPROVAL_ERROR_COMPONENT,
                        },
                        description: `Building or suite number. ${CLINIC_APPROVAL_MARKER}.`,
                        width: '30%',
                      },
                      validate: createConditionalRequiredValidator(
                        validations.text,
                        clinicApprovalRequirementSet,
                        clinicApprovalRequirements.houseNumber,
                      ),
                    },
                  ],
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'zipCode',
                      type: 'number',
                      admin: {
                        components: {
                          Error: CLINIC_APPROVAL_ERROR_COMPONENT,
                        },
                        description: `Postal code. ${CLINIC_APPROVAL_MARKER}.`,
                        width: '40%',
                      },
                      validate: createConditionalRequiredValidator(
                        validations.number,
                        clinicApprovalRequirementSet,
                        clinicApprovalRequirements.zipCode,
                      ),
                    },
                    {
                      name: 'city',
                      type: 'relationship',
                      relationTo: 'cities',
                      admin: {
                        components: {
                          Error: CLINIC_APPROVAL_ERROR_COMPONENT,
                        },
                        description: `City where the clinic is located. ${CLINIC_APPROVAL_MARKER}.`,
                        width: '60%',
                      },
                      validate: createConditionalRequiredValidator(
                        validations.relationship,
                        clinicApprovalRequirementSet,
                        clinicApprovalRequirements.city,
                      ),
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          label: 'Contact',
          fields: [
            {
              name: 'contact',
              type: 'group',
              admin: {
                description: 'Clinic contact details',
              },
              fields: [
                {
                  name: 'phoneNumber',
                  type: 'text',
                  admin: {
                    description: 'Phone number',
                  },
                },
                {
                  name: 'email',
                  type: 'email',
                  admin: {
                    description: 'Contact email',
                  },
                },
                {
                  name: 'website',
                  type: 'text',
                  admin: {
                    description: 'Clinic website',
                  },
                  validate: (val: string | string[] | null | undefined) => {
                    if (val && typeof val === 'string' && !val.match(/^https?:\/\/.+\..+$/)) {
                      return 'Please enter a valid URL starting with http:// or https://'
                    }
                    return true
                  },
                },
              ],
            },
            {
              name: 'internalPrimaryContact',
              label: 'Internal Primary Contact',
              type: 'group',
              access: {
                read: platformClinicTrustFieldAccess,
                create: platformClinicTrustFieldAccess,
                update: platformClinicTrustFieldAccess,
              },
              admin: {
                description: 'First clinic contact for findmydoc follow-up',
                condition: (_data, _siblingData, { user }) => Boolean(user && user.collection === 'platformStaff'),
              },
              fields: [
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'firstName',
                      label: 'First Name',
                      type: 'text',
                      admin: {
                        components: {
                          Error: CLINIC_APPROVAL_ERROR_COMPONENT,
                        },
                        description: `Given name of the first contact. ${CLINIC_APPROVAL_MARKER}.`,
                        width: '50%',
                      },
                      validate: createConditionalRequiredValidator(
                        validations.text,
                        clinicApprovalRequirementSet,
                        clinicApprovalRequirements.contactFirstName,
                      ),
                    },
                    {
                      name: 'lastName',
                      label: 'Last Name',
                      type: 'text',
                      admin: {
                        components: {
                          Error: CLINIC_APPROVAL_ERROR_COMPONENT,
                        },
                        description: `Family name of the first contact. ${CLINIC_APPROVAL_MARKER}.`,
                        width: '50%',
                      },
                      validate: createConditionalRequiredValidator(
                        validations.text,
                        clinicApprovalRequirementSet,
                        clinicApprovalRequirements.contactLastName,
                      ),
                    },
                  ],
                },
                {
                  name: 'email',
                  label: 'Email',
                  type: 'email',
                  admin: {
                    components: {
                      Error: CLINIC_APPROVAL_ERROR_COMPONENT,
                    },
                    description: `Email for internal follow-up. ${CLINIC_APPROVAL_MARKER}.`,
                  },
                  validate: createConditionalRequiredValidator(
                    validations.email,
                    clinicApprovalRequirementSet,
                    clinicApprovalRequirements.contactEmail,
                  ),
                },
                {
                  name: 'role',
                  label: 'Role',
                  type: 'select',
                  options: clinicContactRoleOptions,
                  admin: {
                    components: {
                      Error: CLINIC_APPROVAL_ERROR_COMPONENT,
                    },
                    description: `Role of the first contact. ${CLINIC_APPROVAL_MARKER}.`,
                  },
                  validate: createConditionalRequiredValidator(
                    validations.select,
                    clinicApprovalRequirementSet,
                    clinicApprovalRequirements.contactRole,
                  ),
                },
              ],
            },
          ],
        },
        {
          label: 'Details & Status',
          fields: [
            {
              name: 'accreditations',
              type: 'relationship',
              relationTo: 'accreditation',
              hasMany: true,
              admin: {
                description: 'Clinic accreditations',
              },
            },
            {
              name: 'status',
              type: 'select',
              options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Pending', value: 'pending' },
                { label: 'Approved', value: 'approved' },
                { label: 'Rejected', value: 'rejected' },
              ],
              defaultValue: 'draft',
              required: true,
              access: {
                create: platformClinicTrustFieldAccess,
                update: platformClinicTrustFieldAccess,
              },
              admin: {
                description: 'Clinic approval status',
                condition: (data, siblingData, { user }) => {
                  // Hide status field from non-platform users in admin UI
                  return Boolean(user && user.collection === 'platformStaff')
                },
              },
            },
            {
              name: 'approvalRequirements',
              type: 'ui',
              admin: {
                condition: (_data, _siblingData, { user }) => Boolean(user && user.collection === 'platformStaff'),
                components: {
                  Field: '@/app/(payload)/components/ClinicApprovalRequirements#ClinicApprovalRequirements',
                },
              },
            },
            {
              name: 'verification',
              type: 'select',
              options: [
                { label: 'Unverified', value: 'unverified' },
                { label: 'Bronze', value: 'bronze' },
                { label: 'Silver', value: 'silver' },
                { label: 'Gold', value: 'gold' },
              ],
              defaultValue: 'unverified',
              access: {
                create: platformClinicTrustFieldAccess,
                update: platformClinicTrustFieldAccess,
              },
              admin: {
                description: 'Verification level',
                condition: (data, siblingData, { user }) => {
                  // Hide verification field from non-platform users in admin UI
                  return Boolean(user && user.collection === 'platformStaff')
                },
              },
            },
            {
              name: 'supportedLanguages',
              type: 'select',
              options: languageOptions,
              hasMany: true,
              admin: {
                components: {
                  Error: CLINIC_APPROVAL_ERROR_COMPONENT,
                },
                description: `Languages the clinic supports. ${CLINIC_APPROVAL_MARKER}.`,
              },
              validate: createConditionalRequiredValidator(
                validations.select,
                clinicApprovalRequirementSet,
                clinicApprovalRequirements.supportedLanguages,
              ),
            },
          ],
        },
      ],
    },
    slugField({
      fieldToUse: 'name',
    }),
  ],
  timestamps: true,
}
