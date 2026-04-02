import { CollectionConfig, slugField } from 'payload'
import { languageOptions } from './common/selectionOptions'
import { generateFullName } from '@/utilities/nameUtils'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { anyone } from '@/access/anyone'
import { platformOrAssignedClinicMutation, platformOrOwnClinicResource } from '@/access/scopeFilters'
import { beforeChangeAssignClinicFromUser } from '@/hooks/clinicOwnership'
import { stableIdBeforeChangeHook, stableIdField } from './common/stableIdField'

export const doctorTitles = [
  { label: 'Dr.', value: 'dr' },
  { label: 'Specialist Dr.', value: 'specialist' },
  { label: 'Surgeon Dr.', value: 'surgeon' },
  { label: 'Assoc. Prof. Dr.', value: 'assoc_prof' },
  { label: 'Prof. Dr.', value: 'prof_dr' },
]

export const doctorGenderOptions = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
]

export const Doctors: CollectionConfig = {
  slug: 'doctors',
  admin: {
    group: 'Medical Network',
    useAsTitle: 'fullName',
    defaultColumns: ['fullName', 'specialization', 'clinic', 'active'],
    description: 'Doctor profiles with specialties, languages, and experience',
  },
  access: {
    read: anyone, // Public read access for all users
    create: platformOrAssignedClinicMutation, // Platform: all, Clinic: assigned clinic only
    update: platformOrOwnClinicResource, // Platform: all, Clinic: only their clinic
    delete: isPlatformBasicUser, // Only Platform can delete
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook, beforeChangeAssignClinicFromUser({ clinicField: 'clinic' })],
  },
  trash: true, // Enable soft delete - records are marked as deleted instead of permanently removed
  fields: [
    stableIdField(),
    {
      name: 'title',
      type: 'select',
      options: doctorTitles,
      admin: {
        description: 'Title before the name',
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
      type: 'row',
      fields: [
        {
          name: 'firstName',
          type: 'text',
          required: true,
          admin: {
            width: '35%',
          },
        },
        {
          name: 'lastName',
          type: 'text',
          required: true,
          admin: {
            width: '35%',
          },
        },
        {
          name: 'gender',
          type: 'select',
          options: doctorGenderOptions,
          required: true,
          admin: {
            width: '30%',
            description: 'Used when no photo is uploaded.',
          },
        },
      ],
    },
    {
      name: 'fullName',
      type: 'text',
      required: true,
      admin: {
        readOnly: true,
        description: 'Full name',
        hidden: true,
      },
      hooks: {
        beforeValidate: [
          ({ siblingData }) => {
            const titleOption = doctorTitles.find((t) => t.value === siblingData?.title)
            const titleLabel = titleOption ? titleOption.label : undefined
            const baseName = generateFullName(undefined, siblingData?.firstName, siblingData?.lastName)
            return titleLabel ? `${titleLabel} ${baseName}` : baseName
          },
        ],
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Profile & Biography',
          fields: [
            {
              name: 'biography',
              type: 'richText',
              required: false,
              admin: {
                description: 'Short bio',
              },
            },
            {
              name: 'profileImage',
              type: 'upload',
              relationTo: 'doctorMedia',
              required: false,
              admin: {
                description: 'Profile photo',
              },
            },
          ],
        },
        {
          label: 'Qualifications & Clinic',
          fields: [
            {
              name: 'clinic',
              type: 'relationship',
              relationTo: 'clinics',
              required: true,
              hasMany: false,
              admin: {
                description: 'Clinic',
                condition: (_data, _siblingData, { user }) =>
                  !(user && user.collection === 'basicUsers' && user.userType === 'clinic'),
              },
            },
            {
              name: 'qualifications',
              type: 'text',
              hasMany: true,
              required: true,
              admin: {
                description: 'Degrees and certificates',
              },
            },
            {
              name: 'experienceYears',
              label: 'Years of Experience',
              type: 'number',
              required: false,
              validate: (value: unknown) => {
                if (value === null || value === undefined) return true
                if (typeof value === 'number' && Number.isFinite(value)) return true
                return 'Experience years must be a valid number'
              },
              admin: {
                description: 'Years of practice',
              },
            },
            {
              name: 'languages',
              type: 'select',
              options: languageOptions,
              hasMany: true,
              required: true,
              admin: {
                description: 'Languages spoken',
              },
            },
          ],
        },
        {
          label: 'Specialties & Treatments',
          fields: [
            {
              name: 'treatments',
              type: 'join',
              collection: 'doctortreatments',
              on: 'doctor',
              admin: {
                defaultColumns: ['treatment', 'specializationLevel'],
                description: 'Treatments with expertise level',
                allowCreate: true,
              },
            },
            {
              name: 'specialties',
              type: 'join',
              collection: 'doctorspecialties',
              on: 'doctor',
              admin: {
                defaultColumns: ['medicalSpecialty', 'specializationLevel', 'certifications'],
                description: 'Specialties with expertise level and certifications',
                allowCreate: true,
              },
            },
          ],
        },
      ],
    },
    slugField({
      fieldToUse: 'fullName',
    }),
  ],
}
