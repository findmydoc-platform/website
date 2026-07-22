import type { Clinic } from '@/payload-types'
import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { slugField } from 'payload'
import { clinicContactRoleOptions, languageOptions } from './common/selectionOptions'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { platformOrOwnClinicProfile, platformOnlyOrApproved } from '@/access/scopeFilters'
import {
  computedOnlyFieldAccess,
  platformClinicTrustAccess,
  platformClinicTrustFieldAccess,
} from '@/access/fieldAccess'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'
import { revalidateClinicChange, revalidateClinicDelete } from '@/hooks/revalidateClinicSurfaces'
import { beforeChangeImmutableField } from '@/hooks/immutability'

const APPROVED_CLINIC_REQUIRED_MESSAGE =
  'Approved clinics require a complete address, internal primary contact, and at least one supported language.'
const GALLERY_ENTRIES_SAME_CLINIC_MESSAGE = 'Gallery entries must belong to this clinic.'

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

const isNonEmptyString = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0

const hasRelation = (value: unknown): boolean => {
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'string') return value.trim().length > 0
  return Boolean(value && typeof value === 'object' && 'id' in value)
}

const mergeGroup = (
  existingValue: unknown,
  incomingValue: unknown,
  hasIncomingValue: boolean,
): Record<string, unknown> => {
  const existing = existingValue && typeof existingValue === 'object' ? existingValue : {}
  if (!hasIncomingValue) return { ...existing }
  if (!incomingValue || typeof incomingValue !== 'object') return {}
  return { ...existing, ...incomingValue }
}

const hasCompleteInternalPrimaryContact = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false

  const contact = value as Record<string, unknown>
  return ['firstName', 'lastName', 'email', 'role'].every((key) => isNonEmptyString(contact[key]))
}

const hasCompleteAddress = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false

  const address = value as Record<string, unknown>
  return (
    isNonEmptyString(address.country) &&
    isNonEmptyString(address.street) &&
    isNonEmptyString(address.houseNumber) &&
    typeof address.zipCode === 'number' &&
    Number.isFinite(address.zipCode) &&
    hasRelation(address.city)
  )
}

const validateApprovedClinicCompleteness: CollectionBeforeValidateHook<Clinic> = ({ data, originalDoc }) => {
  if (!data) return data

  const status = data.status ?? originalDoc?.status
  if (status !== 'approved') return data

  const address = mergeGroup(originalDoc?.address, data.address, Object.prototype.hasOwnProperty.call(data, 'address'))
  const internalPrimaryContact = mergeGroup(
    originalDoc?.internalPrimaryContact,
    data.internalPrimaryContact,
    Object.prototype.hasOwnProperty.call(data, 'internalPrimaryContact'),
  )
  const supportedLanguages = Object.prototype.hasOwnProperty.call(data, 'supportedLanguages')
    ? data.supportedLanguages
    : originalDoc?.supportedLanguages

  if (
    !hasCompleteAddress(address) ||
    !hasCompleteInternalPrimaryContact(internalPrimaryContact) ||
    !Array.isArray(supportedLanguages) ||
    supportedLanguages.length === 0
  ) {
    throw new Error(APPROVED_CLINIC_REQUIRED_MESSAGE)
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
    beforeValidate: [validateApprovedClinicCompleteness, validateGalleryEntriesBeforeValidate],
    beforeChange: [
      stableIdBeforeChangeHook,
      beforeChangeImmutableField({ field: 'onboardingKey', message: 'onboardingKey cannot be changed once set' }),
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
              admin: {
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
                    description: 'Country where the clinic is located',
                  },
                },
                {
                  type: 'row',
                  fields: [
                    {
                      name: 'street',
                      type: 'text',
                      admin: {
                        description: 'Street name',
                        width: '70%',
                      },
                    },
                    {
                      name: 'houseNumber',
                      type: 'text',
                      admin: {
                        description: 'Building or suite number',
                        width: '30%',
                      },
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
                        description: 'Postal code',
                        width: '40%',
                      },
                    },
                    {
                      name: 'city',
                      type: 'relationship',
                      relationTo: 'cities',
                      admin: {
                        description: 'City where the clinic is located',
                        width: '60%',
                      },
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
                        description: 'Given name of the first contact',
                        width: '50%',
                      },
                    },
                    {
                      name: 'lastName',
                      label: 'Last Name',
                      type: 'text',
                      admin: {
                        description: 'Family name of the first contact',
                        width: '50%',
                      },
                    },
                  ],
                },
                {
                  name: 'email',
                  label: 'Email',
                  type: 'email',
                  admin: {
                    description: 'Email for internal follow-up',
                  },
                },
                {
                  name: 'role',
                  label: 'Role',
                  type: 'select',
                  options: clinicContactRoleOptions,
                  admin: {
                    description: 'Role of the first contact',
                  },
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
                description: 'Languages the clinic supports',
              },
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
