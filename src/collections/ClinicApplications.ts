import { CollectionConfig } from 'payload'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

// Basic public -> platform controlled application intake for clinics.
// Public can create, only platform staff can read/update/delete.
// Approval workflow: platform sets status to approved; future hook will materialize real Clinic & user.

export const ClinicApplications: CollectionConfig = {
  slug: 'clinicApplications',
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, operation, req, context }) => {
        try {
          if (operation !== 'update') return
          // Only act on status transition submitted -> approved
          if (previousDoc?.status === 'approved' || doc.status !== 'approved') return
          // Idempotency: if artifacts already exist, skip
            if (doc?.createdArtifacts?.clinic) return

          const payload = req.payload
          const now = new Date().toISOString()

          // Create BasicUser (clinic) with random password placeholder (actual provisioning hook will wire Supabase)
          const tempPassword = Math.random().toString(36).slice(-12) + '!A1'
          const basicUser = await payload.create({
            collection: 'basicUsers',
            data: {
              email: doc.contactEmail.toLowerCase(),
              firstName: doc.contactFirstName,
              lastName: doc.contactLastName,
              userType: 'clinic',
              password: tempPassword,
            },
            overrideAccess: true,
          }).catch((e) => {
            req.payload.logger.error({ msg: 'clinicApplications: basicUser create failed', error: e })
            throw e
          })

          // Create Clinic with minimal fields (city left un-normalized; will need manual enrichment to map real Cities relationship)
          // Resolve a city: attempt exact case-insensitive match on Cities collection by name; fallback to first city
          let cityId: number | undefined
          try {
            const cities = await payload.find({
              collection: 'cities',
              where: { name: { like: doc.address?.city || '' } },
              limit: 1,
              overrideAccess: true,
            })
            if (cities.docs.length) cityId = (cities.docs[0] as any).id
            else {
              const anyCity = await payload.find({ collection: 'cities', limit: 1, overrideAccess: true })
              if (anyCity.docs.length) cityId = (anyCity.docs[0] as any).id
            }
          } catch (e) {
            req.payload.logger.warn({ msg: 'clinicApplications: city lookup failed', error: e })
          }
          if (!cityId) {
            req.payload.logger.warn({ msg: 'clinicApplications: no city available, aborting clinic materialization', applicationId: doc.id })
            return
          }

          const clinic = await payload.create({
            collection: 'clinics',
            data: {
              name: doc.clinicName,
              address: {
                country: doc.address?.country || 'Turkey',
                street: doc.address?.street,
                houseNumber: doc.address?.houseNumber,
                zipCode: doc.address?.zipCode,
                city: cityId,
              },
              contact: {
                phoneNumber: doc.contactPhone || '',
                email: doc.contactEmail,
              },
              status: 'pending',
              supportedLanguages: ['english'],
            },
            overrideAccess: true,
          }).catch((e) => {
            req.payload.logger.error({ msg: 'clinicApplications: clinic create failed', error: e })
            throw e
          })

          // Create ClinicStaff profile referencing user + clinic (pending status by default)
          const clinicStaff = await payload.create({
            collection: 'clinicStaff',
            data: {
              user: basicUser.id,
              clinic: clinic.id,
              status: 'pending',
            },
            overrideAccess: true,
          }).catch((e) => {
            req.payload.logger.error({ msg: 'clinicApplications: clinicStaff create failed', error: e })
            throw e
          })

          await payload.update({
            collection: 'clinicApplications',
            id: doc.id,
            data: {
              createdArtifacts: {
                clinic: clinic.id,
                basicUser: basicUser.id,
                clinicStaff: clinicStaff.id,
                processedAt: now,
              },
            },
            overrideAccess: true,
          })

          req.payload.logger.info({
            msg: 'clinicApplications: approval materialized',
            applicationId: doc.id,
            clinicId: clinic.id,
            basicUserId: basicUser.id,
            clinicStaffId: clinicStaff.id,
          })
        } catch (error) {
          req.payload.logger.error({ msg: 'clinicApplications: approval hook error', error })
        }
      },
    ],
  },
  admin: {
    useAsTitle: 'clinicName',
    group: 'Medical Network',
    defaultColumns: ['clinicName', 'status', 'contactEmail', 'createdAt'],
    description: 'Inbound clinic registration submissions awaiting review',
  },
  access: {
    create: () => true, // public intake
    read: isPlatformBasicUser, // only platform staff can view
    update: isPlatformBasicUser,
    delete: isPlatformBasicUser,
  },
  fields: [
    {
      name: 'clinicName',
      type: 'text',
      required: true,
      index: true,
    },
    {
      type: 'row',
      fields: [
        { name: 'contactFirstName', type: 'text', required: true },
        { name: 'contactLastName', type: 'text', required: true },
      ],
    },
    { name: 'contactEmail', type: 'email', required: true, index: true },
    { name: 'contactPhone', type: 'text' },
    {
      name: 'address',
      type: 'group',
      fields: [
        { name: 'street', type: 'text', required: true },
        { name: 'houseNumber', type: 'text', required: true },
  { name: 'zipCode', type: 'number', required: true },
        { name: 'city', type: 'text', required: true },
        { name: 'country', type: 'text', required: true, defaultValue: 'Turkey' },
      ],
    },
    { name: 'additionalNotes', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      defaultValue: 'submitted',
      required: true,
      options: [
        { label: 'Submitted', value: 'submitted' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: { description: 'Review lifecycle status' },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      admin: { description: 'Internal reviewer notes' },
      access: {
        update: ({ req }) => {
          const u: any = req.user
          return Boolean(u && u.collection === 'basicUsers' && u.userType === 'platform')
        },
      },
    },
    {
      name: 'createdArtifacts',
      type: 'group',
      admin: {
        description: 'Records created upon approval',
        readOnly: true,
        condition: (data) => data?.status !== 'submitted',
      },
      fields: [
        { name: 'clinic', type: 'relationship', relationTo: 'clinics' },
        { name: 'basicUser', type: 'relationship', relationTo: 'basicUsers' },
        { name: 'clinicStaff', type: 'relationship', relationTo: 'clinicStaff' },
        { name: 'processedAt', type: 'date' },
      ],
    },
    {
      name: 'sourceMeta',
      type: 'group',
      admin: { description: 'Captured metadata', readOnly: true, position: 'sidebar' },
      fields: [
        { name: 'ip', type: 'text' },
        { name: 'userAgent', type: 'text' },
      ],
    },
  ],
  timestamps: true,
}
