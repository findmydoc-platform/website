import { CollectionConfig } from 'payload'
import { randomBytes } from 'node:crypto'
import { slugify } from '@/utilities/slugify'
import { isPlatformBasicUser } from '@/access/isPlatformBasicUser'

// Basic public -> platform controlled application intake for clinics.
// Public can create, only platform staff can read/update/delete.
// Approval workflow: platform sets status to approved; future hook will materialize real Clinic & user.

export const ClinicApplications: CollectionConfig = {
  slug: 'clinicApplications',
  hooks: {
    beforeChange: [
      async ({ req, data, originalDoc, operation }) => {
        try {
          if (operation !== 'update') return data
          // Only act on status transition submitted -> approved
          if (originalDoc?.status === 'approved' || data.status !== 'approved') return data
          // Idempotency: if artifacts already exist, skip
          if (originalDoc?.createdArtifacts?.clinic) return data
          if ((data as any)?.createdArtifacts?.clinic) return data

          const payload = req.payload
          const now = new Date().toISOString()

          // Create-or-reuse BasicUser (clinic)
          const tempPassword = (() => {
            const base = randomBytes(9)
              .toString('base64')
              .replace(/[^a-zA-Z0-9]/g, '')
              .slice(0, 9)
            return base + 'Aa1'
          })()
          const email = (originalDoc.contactEmail || data.contactEmail || '').toLowerCase()
          let basicUser: any
          try {
            const existingBU = await payload.find({
              collection: 'basicUsers',
              where: { email: { equals: email } },
              limit: 1,
              overrideAccess: true,
            })
            if (existingBU.docs[0]) basicUser = existingBU.docs[0]
          } catch {}
          if (!basicUser) {
            basicUser = await payload
              .create({
                collection: 'basicUsers',
                data: {
                  email,
                  firstName: originalDoc.contactFirstName || data.contactFirstName,
                  lastName: originalDoc.contactLastName || data.contactLastName,
                  userType: 'clinic',
                  password: tempPassword,
                },
                overrideAccess: true,
              })
              .catch((e) => {
                req.payload.logger.error({ msg: 'clinicApplications: basicUser create failed', error: e })
                throw e
              })
          }

          // Resolve a city id; fallback to first city
          let cityId: number | undefined
          try {
            const targetCity = originalDoc.address?.city || data.address?.city || ''
            const cities = await payload.find({
              collection: 'cities',
              where: { name: { like: targetCity } },
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
            req.payload.logger.warn({
              msg: 'clinicApplications: no city available, aborting clinic materialization',
              applicationId: originalDoc.id,
            })
            return data
          }

          // Deterministic clinic slug and contact email
          const slugBase = slugify(originalDoc.clinicName || data.clinicName || 'clinic')
          const clinicSlug = `${slugBase}-${originalDoc.id}`
          let clinic: any
          try {
            const existingClinic = await payload.find({
              collection: 'clinics',
              where: { slug: { equals: clinicSlug } },
              limit: 1,
              overrideAccess: true,
            })
            if (existingClinic.docs[0]) clinic = existingClinic.docs[0]
          } catch {}
          if (!clinic) {
            clinic = await payload
              .create({
                collection: 'clinics',
                data: {
                  name: originalDoc.clinicName || data.clinicName,
                  slug: clinicSlug,
                  address: {
                    country: originalDoc.address?.country || data.address?.country || 'Turkey',
                    street: originalDoc.address?.street || data.address?.street,
                    houseNumber: originalDoc.address?.houseNumber || data.address?.houseNumber,
                    zipCode: originalDoc.address?.zipCode || data.address?.zipCode,
                    city: cityId,
                  },
                  contact: {
                    phoneNumber: originalDoc.contactPhone || data.contactPhone || '',
                    email,
                  },
                  status: 'pending',
                  supportedLanguages: ['english'],
                },
                overrideAccess: true,
              })
              .catch((e) => {
                req.payload.logger.error({ msg: 'clinicApplications: clinic create failed', error: e })
                throw e
              })
          }

          // Create-or-reuse ClinicStaff by user
          let clinicStaff: any
          try {
            const existingByUser = await payload.find({
              collection: 'clinicStaff',
              where: { user: { equals: basicUser.id } },
              limit: 1,
              overrideAccess: true,
            })
            if (existingByUser.docs[0]) clinicStaff = existingByUser.docs[0]
          } catch {}
          if (clinicStaff) {
            if (!clinicStaff.clinic) {
              clinicStaff = await payload
                .update({
                  collection: 'clinicStaff',
                  id: clinicStaff.id,
                  data: { clinic: clinic.id, status: 'pending' },
                  overrideAccess: true,
                })
                .catch((e) => {
                  req.payload.logger.error({ msg: 'clinicApplications: clinicStaff update failed', error: e })
                  throw e
                })
            }
          } else {
            clinicStaff = await payload
              .create({
                collection: 'clinicStaff',
                data: { user: basicUser.id, clinic: clinic.id, status: 'pending' },
                overrideAccess: true,
              })
              .catch((e) => {
                req.payload.logger.error({ msg: 'clinicApplications: clinicStaff create failed', error: e })
                throw e
              })
          }

          // Attach created artifacts to the same update payload
          ;(data as any).createdArtifacts = {
            clinic: clinic.id,
            basicUser: basicUser.id,
            clinicStaff: clinicStaff.id,
            processedAt: now,
          }

          return data
        } catch (error) {
          req.payload.logger.error({ msg: 'clinicApplications: beforeChange error', error })
          return data
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
        update: isPlatformBasicUser,
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
