import type { PayloadRequest } from 'payload'

export async function findDuplicateClinicApplication(
  req: PayloadRequest,
  input: { clinicName: string; contactEmail: string },
  overrideAccess: boolean,
) {
  const result = await req.payload.find({
    collection: 'clinicApplications',
    req,
    overrideAccess,
    depth: 0,
    limit: 1,
    where: {
      and: [
        { clinicName: { equals: input.clinicName } },
        { contactEmail: { equals: input.contactEmail } },
        { status: { in: ['submitted', 'approved'] } },
      ],
    },
  })
  return result.docs[0] ?? null
}
