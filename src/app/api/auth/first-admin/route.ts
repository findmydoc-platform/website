import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * API endpoint for first admin user creation using Supabase Admin API
 * This handles creating the first admin user securely on the server
 */
export async function POST(request: Request) {
  try {
    const { email, password, firstName, lastName } = await request.json()

    // Basic validation
    if (!email || !password || !firstName || !lastName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create admin client with service role key
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      },
    )

    // Check if any users with platform role already exist
    const { data: existingUsers, error: fetchError } = await supabase.auth.admin.listUsers()

    if (fetchError) {
      console.error('Error checking existing users:', fetchError)
      return NextResponse.json({ error: 'Failed to verify first user status' }, { status: 500 })
    }

    // Filter for any users with platform role
    const platformUsers =
      existingUsers?.users?.filter((user) => user.app_metadata?.user_type === 'platform') || []

    // If platform users already exist, prevent creation
    if (platformUsers.length > 0) {
      return NextResponse.json({ error: 'Admin user already exists' }, { status: 400 })
    }

    // Create first admin user with admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: {
        first_name: firstName,
        last_name: lastName,
      },
      app_metadata: {
        user_type: 'platform', // Set platform role directly
      },
      email_confirm: true, // Auto-confirm email for first user
    })

    if (error) {
      console.error('Failed to create first user:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      userId: data.user.id,
      message: 'First admin user created successfully',
    })
  } catch (error: any) {
    console.error('Unexpected error in first-admin API:', error)
    return NextResponse.json({ error: 'Failed to create admin user' }, { status: 500 })
  }
}
