import type { ClinicStaff } from '@/payload-types'
import { deleteClinicSupabaseAccount, setClinicSupabaseAccountAccess } from '@/auth/utilities/supabaseProvision'
import type { CollectionAfterChangeHook, CollectionBeforeChangeHook } from 'payload'

type ClinicStaffStatus = NonNullable<ClinicStaff['status']>
type AuthSyncErrorCode = NonNullable<NonNullable<ClinicStaff['authSync']>['errorCode']>

const allowedTransitions: Record<ClinicStaffStatus, readonly ClinicStaffStatus[]> = {
  pending: ['approved', 'rejected', 'offboarded'],
  approved: ['disabled', 'offboarded'],
  disabled: ['approved', 'offboarded'],
  rejected: ['offboarded'],
  offboarded: [],
}

export const validateClinicStaffStatusTransition: CollectionBeforeChangeHook<ClinicStaff> = async ({
  data,
  operation,
  originalDoc,
}) => {
  if (operation !== 'update' || !originalDoc?.status) return data

  const previousStatus = originalDoc.status
  const nextStatus = data.status ?? previousStatus
  if (nextStatus === previousStatus) return data

  if (!allowedTransitions[previousStatus].includes(nextStatus)) {
    throw new Error(`Clinic staff status transition ${previousStatus} -> ${nextStatus} is not allowed`)
  }

  return data
}

const updateAuthSync = async (
  req: Parameters<CollectionAfterChangeHook<ClinicStaff>>[0]['req'],
  id: number | string,
  status: 'deleted' | 'failed' | 'synced',
  errorCode: AuthSyncErrorCode | null,
) => {
  await req.payload.update({
    collection: 'clinicStaff',
    id,
    context: { ...req.context, skipClinicStaffAuthSync: true },
    data: { authSync: { errorCode, status } },
    depth: 0,
    overrideAccess: true,
    req,
  })
}

export const synchronizeClinicStaffAuthState: CollectionAfterChangeHook<ClinicStaff> = async ({
  doc,
  previousDoc,
  req,
}) => {
  if (req.context?.skipClinicStaffAuthSync || doc.status === 'pending') return doc

  const expectedSyncStatus = doc.status === 'offboarded' ? 'deleted' : 'synced'
  const statusChanged = previousDoc?.status !== doc.status
  if (!statusChanged && doc.authSync?.status === expectedSyncStatus) return doc

  let failureCode: AuthSyncErrorCode = doc.status === 'offboarded' ? 'account_delete_failed' : 'account_update_failed'

  try {
    if (!doc.supabaseUserId) {
      if (doc.status === 'offboarded') {
        await updateAuthSync(req, doc.id, 'deleted', null)
        return doc
      }

      failureCode = 'missing_identity'
      throw new Error('Clinic staff has no Supabase identity')
    }

    if (doc.status === 'offboarded') {
      await deleteClinicSupabaseAccount(doc.supabaseUserId, req.payload.logger)
      await updateAuthSync(req, doc.id, 'deleted', null)
    } else {
      await setClinicSupabaseAccountAccess(
        { enabled: doc.status === 'approved', supabaseUserId: doc.supabaseUserId },
        req.payload.logger,
      )
      await updateAuthSync(req, doc.id, 'synced', null)
    }
  } catch (error) {
    req.payload.logger.error(
      {
        clinicStaffId: doc.id,
        err: error instanceof Error ? error : new Error(String(error)),
        event: 'clinic_staff.auth_sync_failed',
        failureCode,
        status: doc.status,
      },
      'Clinic staff Supabase state could not be synchronized',
    )

    try {
      await updateAuthSync(req, doc.id, 'failed', failureCode)
    } catch (stateError) {
      req.payload.logger.error(
        {
          clinicStaffId: doc.id,
          err: stateError instanceof Error ? stateError : new Error(String(stateError)),
          event: 'clinic_staff.auth_sync_failure_state_failed',
        },
        'Clinic staff auth sync failure state could not be stored',
      )
    }
  }

  return doc
}
