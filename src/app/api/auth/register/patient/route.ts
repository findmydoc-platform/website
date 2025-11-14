/**
 * Patient Registration Endpoint (modernized)
 *
 * Creates a Patient by writing to the `patients` collection so the collection
 * hooks handle Supabase user provisioning. This keeps a single source of truth
 * and avoids duplicating Supabase logic here.
 */
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'

export async function POST(request: Request) {
  try {
    const body = await request.json()

    if (!body.supabaseUserId) {
      return NextResponse.json({ error: 'Supabase user id is required' }, { status: 400 })
    }

    const payload = await getPayload({ config: configPromise })
    const supabase = await createAdminClient()

    const { error: updateError } = await supabase.auth.admin.updateUserById(body.supabaseUserId, {
      app_metadata: { user_type: 'patient' },
      user_metadata: {
        first_name: body.firstName,
        last_name: body.lastName,
      },
    })

    if (updateError) {
      throw new Error(updateError.message)
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
    return NextResponse.json(
      { error: typeof error?.message === 'string' ? error.message : 'Patient registration failed' },
      { status: 400 },
    )
  }
}
