import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import configPromise from '@/payload.config'
import { createAdminClient } from '@/auth/utilities/supaBaseServer'
import { z } from 'zod'

const createAdminSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  role: z.enum(['admin', 'support', 'content-manager']).default('admin'),
})

export async function POST(request: NextRequest) {
  try {
    const payload = await getPayload({ config: configPromise })

    // Check if the requesting user is a platform admin
    const { user } = await payload.auth({ headers: request.headers })

    if (!user || user.collection !== 'basicUsers' || user.userType !== 'platform') {
      return NextResponse.json(
        { error: 'Unauthorized. Only platform staff can access this endpoint.' },
        { status: 403 },
      )
    }

    // Verify the user is actually a platform admin
    const platformStaffResult = await payload.find({
      collection: 'plattformStaff',
      where: {
        user: { equals: user.id },
        role: { equals: 'admin' },
      },
      limit: 1,
    })

    if (platformStaffResult.docs.length === 0) {
      return NextResponse.json(
        { error: 'Forbidden. Only platform admins can create new admins.' },
        { status: 403 },
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = createAdminSchema.parse(body)

    const { email, firstName, lastName, role } = validatedData

    // Generate a temporary password
    const tempPassword = generateSecurePassword()

    // Create user in Supabase
    const supabase = await createAdminClient()
    const { data: supabaseUser, error: supabaseError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true, // Auto-confirm email for admin-created users
      user_metadata: {
        userType: 'platform',
        firstName,
        lastName,
      },
    })

    if (supabaseError || !supabaseUser.user) {
      payload.logger.error('Failed to create Supabase user:', supabaseError)
      return NextResponse.json(
        { error: 'Failed to create user account. Please try again.' },
        { status: 500 },
      )
    }

    try {
      // Create BasicUser record in PayloadCMS
      const basicUser = await payload.create({
        collection: 'basicUsers',
        data: {
          email,
          supabaseUserId: supabaseUser.user.id,
          userType: 'platform',
        },
        overrideAccess: true, // Bypass access controls for server-side creation
      })

      // Create PlattformStaff profile
      const platformStaff = await payload.create({
        collection: 'plattformStaff',
        data: {
          user: basicUser.id,
          firstName,
          lastName,
          role,
        },
        overrideAccess: true, // Bypass access controls for server-side creation
      })

      payload.logger.info(`Platform admin created successfully: ${email} (${role})`)

      return NextResponse.json({
        success: true,
        message: 'Platform admin created successfully',
        admin: {
          id: platformStaff.id,
          email,
          firstName,
          lastName,
          role,
          tempPassword, // Return temp password for sharing with new admin
        },
      })
    } catch (payloadError) {
      // If PayloadCMS creation fails, clean up Supabase user
      await supabase.auth.admin.deleteUser(supabaseUser.user.id)

      payload.logger.error('Failed to create PayloadCMS records:', payloadError)
      return NextResponse.json(
        { error: 'Failed to create admin profile. Please try again.' },
        { status: 500 },
      )
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input data', details: error.errors },
        { status: 400 },
      )
    }

    console.error('Error in create-platform-admin:', error)
    return NextResponse.json({ error: 'Internal server error. Please try again.' }, { status: 500 })
  }
}

function generateSecurePassword(): string {
  const length = 12
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
  let password = ''

  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length))
  }

  return password
}
