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

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const payload = await getPayload({ config: configPromise })

    const created = await payload.create({
      collection: 'patients',
      data: {
        email: body.email,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth,
        phoneNumber: body.phoneNumber ?? body.phone,
      },
      overrideAccess: true,
      req: { context: { password: body.password } },
    })

    return NextResponse.json({ success: true, userId: created.id })
  } catch (error: any) {
    return NextResponse.json(
      { error: typeof error?.message === 'string' ? error.message : 'Patient registration failed' },
      { status: 400 },
    )
  }
}
