import payload from 'payload'
import { createAdminClient } from '@/utilities/supabase/server'
import { NextResponse } from 'next/server'
export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName } = await request.json()

    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createAdminClient()

    // Only allow creation if no platform users exist yet
    const { data: existingUsers, error: fetchError } = await supabase.auth.admin.listUsers()
    if (fetchError) {
      payload.logger.error('Error checking existing users:', fetchError)
      return NextResponse.json({ error: 'Failed to verify first user status' }, { status: 500 })
    }
    const platformUsers =
      existingUsers?.users?.filter((user) => user.app_metadata?.user_type === 'platform') || []
    if (platformUsers.length > 0) {
      return NextResponse.json({ error: 'Admin user already exists' }, { status: 400 })
    }

    // Set platform role directly and auto-confirm email for first user
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
      app_metadata: {
        user_type: 'platform',
      },
      email_confirm: true,
    })

    if (error) {
      payload.logger.error('Failed to create first user:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      userId: data.user.id,
      message: 'First admin user created successfully',
    })
  } catch (error: any) {
    payload.logger.error('Unexpected error in first-admin API:', error)
    return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 })
  }
}
