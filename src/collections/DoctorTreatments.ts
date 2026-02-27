import { CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { isClinicBasicUser } from '@/access/isClinicBasicUser'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'
import { platformOrAssignedClinicMutation, platformOrOwnClinicDoctorResource } from '@/access/scopeFilters'
import { getUserAssignedClinicId } from '@/access/utils/getClinicAssignment'
import { stableIdBeforeChangeHook, stableIdField } from '@/collections/common/stableIdField'
import { beforeChangeEnforceDoctorInAssignedClinic } from '@/hooks/clinicOwnership'

export const DoctorTreatments: CollectionConfig = {
  slug: 'doctortreatments',
  labels: {
    singular: 'Doctor Treatment',
    plural: 'Doctor Treatments',
  },
  admin: {
    group: 'Medical Network',
    description: 'Assign treatments to doctors and track their expertise level',
    useAsTitle: 'id',
    defaultColumns: ['doctor', 'treatment', 'specializationLevel'],
  },
  access: {
    read: anyone, // Public read access
    create: platformOrAssignedClinicMutation, // Platform: all, Clinic: assigned clinic only
    update: platformOrOwnClinicDoctorResource, // Platform: all, Clinic: only doctors from their clinic
    delete: isPlatformBasicUser, // Only Platform can delete
  },
  hooks: {
    beforeChange: [stableIdBeforeChangeHook, beforeChangeEnforceDoctorInAssignedClinic({ doctorField: 'doctor' })],
  },
  timestamps: true,
  fields: [
    stableIdField(),
    {
      name: 'doctor',
      type: 'relationship',
      relationTo: 'doctors',
      hasMany: false,
      required: true,
      admin: {
        description: 'Link to the doctor.',
        allowCreate: false,
      },
      filterOptions: async ({ req }) => {
        if (!req.user) return true
        if (isPlatformBasicUser({ req })) return true
        if (!isClinicBasicUser({ req })) return false

        const clinicId = await getUserAssignedClinicId(req.user, req.payload)
        if (clinicId === null) return false

        return {
          clinic: {
            equals: clinicId,
          },
        }
      },
    },
    {
      name: 'treatment',
      type: 'relationship',
      relationTo: 'treatments',
      hasMany: false,
      required: true,
      admin: {
        description: 'Link to the treatment.',
        allowCreate: false,
      },
    },
    {
      name: 'specializationLevel',
      type: 'select',
      required: true,
      options: [
        { label: 'General Practice', value: 'general_practice' },
        { label: 'Specialist', value: 'specialist' },
        { label: 'Sub-specialist', value: 'sub_specialist' },
      ],
      admin: {
        description: `Doctor's expertise level for this treatment`,
      },
    },
    {
      name: 'treatmentsPerformed',
      type: 'number',
      admin: {
        readOnly: true,
        description: 'Number of times this doctor has performed the treatment',
        condition: () => false, // Hides the field from the edit view by default but shows in list view if in defaultColumns
      },
      access: {
        create: () => false,
        update: () => false,
      },
    },
  ],
  indexes: [
    {
      fields: ['doctor', 'treatment'],
      unique: true,
    },
  ],
}
