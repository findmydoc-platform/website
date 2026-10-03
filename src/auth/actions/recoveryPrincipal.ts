import type { PayloadRequest } from 'payload'
import type { ClinicStaff, Patient, PlatformStaff } from '@/payload-types'
import { z } from 'zod'
import { isValidEmail, normalizeEmail } from '@/auth/utilities/emailNormalization'

export const recoveryActionTypes = ['patient-recovery', 'clinic-recovery', 'platform-recovery'] as const
export type RecoveryActionType = (typeof recoveryActionTypes)[number]
export type RecoveryPrincipal =
  | { actionType: 'patient-recovery'; collection: 'patients'; userType: 'patient'; document: Patient }
  | { actionType: 'clinic-recovery'; collection: 'clinicStaff'; userType: 'clinic'; document: ClinicStaff }
  | { actionType: 'platform-recovery'; collection: 'platformStaff'; userType: 'platform'; document: PlatformStaff }

/** Recovery admits existing principals, including staff who still need to complete their password. */
function eligible(principal: RecoveryPrincipal) {
  const doc = principal.document
  const email = normalizeEmail(doc.email ?? '')
  if (!isValidEmail(email) || email.length > 254 || !z.string().uuid().safeParse(doc.supabaseUserId).success)
    return false
  if ('deletedAt' in doc && doc.deletedAt) return false
  return (
    principal.collection !== 'clinicStaff' ||
    (['pending', 'approved'].includes(principal.document.status ?? '') &&
      principal.document.authSync?.status === 'synced')
  )
}

/** Six bounded queries reject duplicate emails and subjects across every authoritative collection. */
export async function findRecoveryPrincipal(req: PayloadRequest, email: string): Promise<RecoveryPrincipal | null> {
  const candidates: RecoveryPrincipal[] = []
  for (const collection of ['patients', 'clinicStaff', 'platformStaff'] as const) {
    const result = await req.payload.find({
      collection,
      req,
      overrideAccess: true,
      depth: 0,
      pagination: false,
      limit: 2,
      where: { email: { equals: normalizeEmail(email) } },
    })
    for (const document of result.docs) {
      if (collection === 'patients')
        candidates.push({
          collection,
          actionType: 'patient-recovery',
          userType: 'patient',
          document: document as Patient,
        })
      else if (collection === 'clinicStaff')
        candidates.push({
          collection,
          actionType: 'clinic-recovery',
          userType: 'clinic',
          document: document as ClinicStaff,
        })
      else
        candidates.push({
          collection,
          actionType: 'platform-recovery',
          userType: 'platform',
          document: document as PlatformStaff,
        })
    }
  }
  const principal = candidates[0]
  if (candidates.length !== 1 || !principal || !eligible(principal)) return null
  for (const collection of ['patients', 'clinicStaff', 'platformStaff'] as const) {
    const result = await req.payload.find({
      collection,
      req,
      overrideAccess: true,
      depth: 0,
      pagination: false,
      limit: 2,
      where: { supabaseUserId: { equals: principal.document.supabaseUserId } },
    })
    if (
      collection === principal.collection
        ? result.docs.length !== 1 || result.docs[0]?.id !== principal.document.id
        : result.docs.length !== 0
    )
      return null
  }
  return principal
}

export async function readRecoveryPrincipal(
  req: PayloadRequest,
  collection: RecoveryPrincipal['collection'],
  id: number,
) {
  const document = await req.payload.findByID({
    collection,
    id,
    req,
    overrideAccess: true,
    depth: 0,
    disableErrors: true,
  })
  if (!document || document.id !== id) return null
  const current = await findRecoveryPrincipal(req, document.email ?? '')
  return current?.collection === collection && current.document.id === id ? current : null
}
