import { CollectionConfig } from 'payload'
import { slugField } from '@/fields/slug'
import { languageOptions } from './common/selectionOptions'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { authenticatedOrApprovedClinic } from '@/access/authenticatedOrApprovedClinic'
import { platformOrOwnClinicProfile } from '@/access/scopeFilters'

export const Clinics: CollectionConfig = {
  slug: 'clinics',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'country'],
    description: 'Clinic profiles with address, contact details and offered services',
  },
  access: {
    read: authenticatedOrApprovedClinic, // Authenticated users see all, anonymous see approved only
    create: isPlatformBasicUser, // Only Platform can create clinics
    update: platformOrOwnClinicProfile, // Platform: all clinics, Clinic: only own profile
    delete: isPlatformBasicUser, // Only Platform can delete clinics
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: {
        description: 'Name of the clinic',
      },
    },
    {
      name: 'averageRating',
      type: 'number',
      min: 0,
      max: 5,
      admin: {
        description: 'Average rating based on patient reviews',
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
                description: 'Detailed description of the clinic',
              },
            },
            {
              name: 'tags',
              type: 'relationship',
              relationTo: 'tags',
              hasMany: true,
              admin: {
                description: 'Link this clinic to one or more Tags',
              },
            },
            {
              name: 'treatments',
              type: 'join',
              collection: 'clinictreatments',
              on: 'treatment',
              admin: {
                defaultColumns: ['treatment', 'price'],
                description: 'Link this clinic to one or more Clinic Treatments',
                allowCreate: true,
              },
            },
            {
              name: 'thumbnail',
              type: 'upload',
              relationTo: 'media',
              admin: {
                description: 'Clinic thumbnail image',
              },
            },
          ],
        },
        {
          label: 'Address',
          fields: [
            {
              name: 'address',
              type: 'group',
              admin: {
                description: 'Clinic address information',
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
                  name: 'coordinates',
                  type: 'point',
                  admin: {
                    description: 'Coordinates for Google Maps',
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
                        description: 'House number',
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
                        description: 'Zip code of clinic',
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
                description: 'Clinic contact information',
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
                    description: 'Email address',
                  },
                },
                {
                  name: 'website',
                  type: 'text',
                  admin: {
                    description: 'Website URL',
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
                description: 'Accreditations held by this clinic',
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
              admin: {
                description: 'Current status of this clinic listing',
              },
            },
            {
              name: 'supportedLanguages',
              type: 'select',
              options: languageOptions,
              hasMany: true,
              required: true,
              admin: {
                description: 'Languages supported by this clinic',
              },
            },
          ],
        },
      ],
    },
    ...slugField('name'),
  ],
  timestamps: true,
}
