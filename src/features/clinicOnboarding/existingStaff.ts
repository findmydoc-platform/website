import type { PayloadRequest, Where } from 'payload'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { isClinicPersonalIdentityReady, readClinicStaffAssignment } from '@/auth/utilities/clinicStaffAssignment'
import { requireCurrentPlatformStaff } from '@/features/clinicDashboard/gallery/platformGallery'

export async function readEligibleExistingClinicStaff(
  req: PayloadRequest,
  lookup: { clinicStaffId: number } | { email: string },
) {
  const where: Where =
    'clinicStaffId' in lookup
      ? { id: { equals: lookup.clinicStaffId } }
      : { email: { equals: normalizeEmail(lookup.email) } }
  const visible = (
    await req.payload.find({
      collection: 'clinicStaff',
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: false,
      select: { email: true, firstName: true, lastName: true },
      where,
      req,
    })
  ).docs[0]
  if (!visible?.email) return null

  // Activation proof is private. Inspect it only for the exact staff record the caller can read.
  const staff = await req.payload.findByID({
    collection: 'clinicStaff',
    id: visible.id,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  })
  if (!staff || !isClinicPersonalIdentityReady(staff) || readClinicStaffAssignment(staff)?.scope !== 'unassigned') {
    return null
  }

  return {
    clinicStaffId: visible.id,
    email: visible.email,
    firstName: visible.firstName ?? null,
    lastName: visible.lastName ?? null,
  }
}

export async function findEligibleClinicOnboardingStaff(req: PayloadRequest, { email }: { email: string }) {
  await requireCurrentPlatformStaff(req)
  return { candidate: await readEligibleExistingClinicStaff(req, { email }) }
}
