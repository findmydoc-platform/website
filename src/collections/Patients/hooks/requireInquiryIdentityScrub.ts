import { APIError, type CollectionBeforeDeleteHook } from 'payload'
import { isPlatformStaff } from '@/access/isPlatformStaff'

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
  if (linked.totalDocs === 0) return

  if (req.user && isPlatformStaff({ req })) {
    const operator = await req.payload.findByID({
      collection: 'platformStaff',
      depth: 0,
      disableErrors: true,
      id: req.user.id,
      overrideAccess: true,
      req,
      select: { capabilities: true },
    })
    if (operator?.capabilities?.includes('inquiry-retention')) {
      throw new APIError('Anonymize the linked inquiries before deleting this account.', 409)
    }
  }

  throw new Error('Patient inquiry identity must be anonymized before deleting the patient account.')
}
