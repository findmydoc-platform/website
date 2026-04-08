import { CollectionConfig, slugField } from 'payload'
import { languageOptions } from './common/selectionOptions'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { platformOrOwnClinicProfile, platformOnlyOrApproved } from '@/access/scopeFilters'
import { platformOnlyFieldAccess } from '@/access/fieldAccess'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

export const Clinics: CollectionConfig = {
  slug: 'clinics',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'country'],
    description: 'Clinic profiles with address, contact details, and services',
  },
  access: {
    read: platformOnlyOrApproved, // Platform Staff: all clinics, Others: approved only
    create: isPlatformBasicUser, // Only Platform can create clinics
    update: platformOrOwnClinicProfile, // Platform: all clinics, Clinic: only own profile
    delete: isPlatformBasicUser, // Only Platform can delete clinics
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook],
  },
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    stableIdField(),
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
                  required: true,
                  defaultValue: 'Turkey',
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
                      required: true,
                      admin: {
                        description: 'Street name',
                        width: '70%',
                      },
                    },
                    {
                      name: 'houseNumber',
                      type: 'text',
                      required: true,
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
                      required: true,
                      admin: {
                        description: 'Postal code',
                        width: '40%',
                      },
                    },
                    {
                      name: 'city',
                      type: 'relationship',
                      relationTo: 'cities',
                      required: true,
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
                  required: true,
                  admin: {
                    description: 'Phone number',
                  },
                },
                {
                  name: 'email',
                  type: 'email',
                  required: true,
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
                description: 'Accreditations this clinic holds',
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
                // Only Platform Staff can change clinic approval status
                create: platformOnlyFieldAccess,
                update: platformOnlyFieldAccess,
              },
              admin: {
                description: 'Clinic approval status',
                condition: (data, siblingData, { user }) => {
                  // Hide status field from non-platform users in admin UI
                  return Boolean(user && user.collection === 'basicUsers' && user.userType === 'platform')
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
              admin: {
                description: 'Verification level',
              },
            },
            {
              name: 'supportedLanguages',
              type: 'select',
              options: languageOptions,
              hasMany: true,
              required: true,
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
