import type { PayloadRequest } from 'payload'
import type { AuthData } from '@/auth/types/authTypes'

interface EnsurePatientArgs {
  payload: any
  authData: AuthData
  req: PayloadRequest | undefined
}

/**
 * Idempotently provisions a patient record when a Supabase user logs in for the first time.
 */
export async function ensurePatientOnAuth({ payload, authData, req }: EnsurePatientArgs) {
  const logger = payload.logger ?? console

  try {
    const existing = await payload.find({
      collection: 'patients',
      where: { supabaseUserId: { equals: authData.supabaseUserId } },
      limit: 1,
      overrideAccess: true,
    })

    if (existing.docs.length > 0) {
      return existing.docs[0]
    }

    const patient = await payload.create({
      collection: 'patients',
      data: {
        supabaseUserId: authData.supabaseUserId,
        email: authData.userEmail,
        firstName: authData.firstName || authData.userEmail.split('@')[0] || 'Patient',
        lastName: authData.lastName || 'Account',
      },
      req,
      overrideAccess: true,
    })

    logger.info(
      {
        supabaseUserId: authData.supabaseUserId,
        collection: 'patients',
        patientId: patient.id,
      },
      'Provisioned patient during first authenticated login',
    )

    return patient
  } catch (error: any) {
    logger.error(
      {
        supabaseUserId: authData.supabaseUserId,
        error: error?.message,
      },
      'Failed to provision patient during authentication',
    )
    throw error
  }
}
