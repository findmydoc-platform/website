/**
 * Patient Registration Finalization (phase 2)
 *
 * Two-step flow overview:
 *   1. Client registers the user with Supabase directly and receives a `supabaseUserId`.
 *   2. The client posts that identifier plus profile fields here so we can:
 *        a. Update Supabase metadata (user/app metadata) to flag the user as a patient.
 *        b. Create the Payload `patients` record, which remains the source of truth for business logic.
 *
 * Other user types (first-admin, clinic/basic staff) still rely on collection hooks for provisioning.
 * Patients live entirely in this route so the invite-free signup flow stays explicit and auditable.
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'

const jsonError = (message: string, status = 400) => NextResponse.json({ error: message }, { status })

export async function POST(request: Request) {
  const payload = await getPayload({ config: configPromise })

  try {
    const body = await request.json()

    if (!body.supabaseUserId) {
      return jsonError('Supabase user id is required')
    }

    const supabase = await createAdminClient()

    const { error: updateError } = await supabase.auth.admin.updateUserById(body.supabaseUserId, {
      app_metadata: { user_type: 'patient' },
      user_metadata: {
        first_name: body.firstName,
        last_name: body.lastName,
      },
    })

    if (updateError) {
      payload.logger.error(
        { supabaseUserId: body.supabaseUserId, updateError },
        'Failed to update Supabase metadata during patient registration',
      )
      return jsonError('Supabase user update failed')
    }

    const created = await payload.create({
      collection: 'patients',
      data: {
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth,
        phoneNumber: body.phoneNumber ?? body.phone,
        supabaseUserId: body.supabaseUserId,
      },
      overrideAccess: true,
    })

    return NextResponse.json({ success: true, userId: created.id })
  } catch (error: any) {
    payload.logger.error(error, 'Patient registration finalization failed')
    return jsonError('Patient registration failed', 500)
  }
}
