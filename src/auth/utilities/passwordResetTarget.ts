import type { ClinicStaff } from '@/payload-types'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import type { Payload } from 'payload'

export type PasswordResetTarget = 'dashboard' | 'suppress' | 'website'

const hasConflictingPrincipal = async (payload: Payload, email: string): Promise<boolean> => {
  const [patients, platformStaff] = await Promise.all([
    payload.find({
      collection: 'patients',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: { email: { equals: email } },
    }),
    payload.find({
      collection: 'platformStaff',
      depth: 0,
      limit: 1,
      overrideAccess: true,
      pagination: false,
      where: { email: { equals: email } },
    }),
  ])

  return patients.docs.length > 0 || platformStaff.docs.length > 0
}

export async function resolvePasswordResetTarget(payload: Payload, email: string): Promise<PasswordResetTarget> {
  const normalizedEmail = normalizeEmail(email)
  const clinicStaffResult = await payload.find({
    collection: 'clinicStaff',
    depth: 0,
    limit: 2,
    overrideAccess: true,
    pagination: false,
    where: { email: { equals: normalizedEmail } },
  })

  if (clinicStaffResult.docs.length === 0) return 'website'
  if (clinicStaffResult.docs.length !== 1) return 'suppress'

  const staff = clinicStaffResult.docs[0] as ClinicStaff
  const statusAllowsReset = staff.status === 'pending' || staff.status === 'approved'
  const identityIsSynced = staff.authSync?.status === 'synced' && Boolean(staff.supabaseUserId)

  if (!statusAllowsReset || !identityIsSynced) return 'suppress'
  if (await hasConflictingPrincipal(payload, normalizedEmail)) return 'suppress'

  return 'dashboard'
}
