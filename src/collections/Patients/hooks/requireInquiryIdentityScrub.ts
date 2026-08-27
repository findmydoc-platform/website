import type { CollectionBeforeDeleteHook } from 'payload'

export const requireInquiryIdentityScrubBeforePatientDeleteHook: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const linked = await req.payload.find({
    collection: 'patientClinicInquiries',
    depth: 0,
    limit: 1,
    overrideAccess: true,
    pagination: false,
    req,
    where: {
      and: [{ patient: { equals: id } }, { retentionState: { equals: 'available' } }],
    },
  })
  if (linked.totalDocs > 0) {
    throw new Error('Patient inquiry identity must be anonymized before deleting the patient account.')
  }
}
