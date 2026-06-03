import { createClient, type User } from '@supabase/supabase-js'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import type { BasicUser, PlatformStaff } from '@/payload-types'
import type { AdminSessionCredentials } from './adminSession'

const readRequiredEnv = (name: string): string => {
  const value = process.env[name]
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required E2E auth environment variable: ${name}.`)
  }

  return value.trim()
}

const resolveName = (user: User, key: 'first_name' | 'last_name', fallback: string): string => {
  const rawValue = user.user_metadata?.[key]
  return typeof rawValue === 'string' && rawValue.trim().length > 0 ? rawValue.trim() : fallback
}

const readFixedSupabasePlatformUser = async (credentials: AdminSessionCredentials): Promise<User> => {
  const supabase = createClient(
    readRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    readRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  })

  if (error || !data.user) {
    throw new Error('The fixed E2E admin Supabase credentials could not be authenticated.')
  }

  if (data.user.app_metadata?.user_type !== 'platform') {
    throw new Error('The fixed E2E admin Supabase account is not marked as a platform user.')
  }

  return data.user
}

export const ensurePlatformAdminPayloadUser = async (credentials: AdminSessionCredentials) => {
  const supabaseUser = await readFixedSupabasePlatformUser(credentials)
  const normalizedEmail = normalizeEmail(supabaseUser.email ?? credentials.email)

  if (!normalizedEmail) {
    throw new Error('The fixed E2E admin Supabase account has no valid email.')
  }

  const payload = await getPayload({ config: configPromise })
  const bySupabaseId = await payload.find({
    collection: 'basicUsers',
    where: { supabaseUserId: { equals: supabaseUser.id } },
    limit: 1,
    overrideAccess: true,
  })
  const byEmail =
    bySupabaseId.docs.length > 0
      ? bySupabaseId
      : await payload.find({
          collection: 'basicUsers',
          where: { email: { equals: normalizedEmail } },
          limit: 1,
          overrideAccess: true,
        })

  let basicUser = byEmail.docs[0] as BasicUser | undefined
  const firstName = resolveName(supabaseUser, 'first_name', 'E2E')
  const lastName = resolveName(supabaseUser, 'last_name', 'Admin')

  if (basicUser) {
    if (basicUser.userType !== 'platform') {
      throw new Error('The fixed E2E admin email already belongs to a non-platform Payload user.')
    }

    basicUser = (await payload.update({
      collection: 'basicUsers',
      id: basicUser.id,
      data: {
        email: normalizedEmail,
        firstName: basicUser.firstName || firstName,
        lastName: basicUser.lastName || lastName,
        supabaseUserId: supabaseUser.id,
        userType: 'platform',
      },
      context: {
        skipProfileCreation: true,
        skipSupabaseUserCreation: true,
      },
      overrideAccess: true,
    })) as BasicUser
  } else {
    basicUser = (await payload.create({
      collection: 'basicUsers',
      data: {
        email: normalizedEmail,
        firstName,
        lastName,
        supabaseUserId: supabaseUser.id,
        userType: 'platform',
      },
      context: {
        skipSupabaseUserCreation: true,
      },
      overrideAccess: true,
    })) as BasicUser
  }

  const platformStaff = await payload.find({
    collection: 'platformStaff',
    where: { user: { equals: basicUser.id } },
    limit: 1,
    overrideAccess: true,
  })
  const existingStaff = platformStaff.docs[0] as PlatformStaff | undefined

  if (!existingStaff) {
    await payload.create({
      collection: 'platformStaff',
      data: {
        role: 'admin',
        user: basicUser.id,
      },
      overrideAccess: true,
    })
    return
  }

  if (existingStaff.role !== 'admin') {
    await payload.update({
      collection: 'platformStaff',
      id: existingStaff.id,
      data: {
        role: 'admin',
      },
      overrideAccess: true,
    })
  }
}
