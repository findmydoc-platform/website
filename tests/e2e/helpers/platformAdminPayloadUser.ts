import { createClient, type User } from '@supabase/supabase-js'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { normalizeEmail } from '@/auth/utilities/emailNormalization'
import { isFindmydocPlatformEmail } from '@/auth/utilities/platformStaffEmailPolicy'
import type { PlatformStaff } from '@/payload-types'
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

  if (!isFindmydocPlatformEmail(normalizedEmail)) {
    throw new Error('The fixed E2E admin Supabase account must use a @findmydoc.eu email.')
  }

  const payload = await getPayload({ config: configPromise })
  const bySupabaseId = await payload.find({
    collection: 'platformStaff',
    where: { supabaseUserId: { equals: supabaseUser.id } },
    limit: 1,
    overrideAccess: true,
  })
  const byEmail =
    bySupabaseId.docs.length > 0
      ? bySupabaseId
      : await payload.find({
          collection: 'platformStaff',
          where: { email: { equals: normalizedEmail } },
          limit: 1,
          overrideAccess: true,
        })

  let platformStaff = byEmail.docs[0] as PlatformStaff | undefined
  const firstName = resolveName(supabaseUser, 'first_name', 'E2E')
  const lastName = resolveName(supabaseUser, 'last_name', 'Admin')

  if (platformStaff) {
    platformStaff = (await payload.update({
      collection: 'platformStaff',
      id: platformStaff.id,
      data: {
        email: normalizedEmail,
        firstName: platformStaff.firstName || firstName,
        lastName: platformStaff.lastName || lastName,
        role: 'admin',
        supabaseUserId: supabaseUser.id,
      },
      context: {
        trustedPlatformStaffOps: true,
      },
      overrideAccess: true,
    })) as PlatformStaff
  } else {
    platformStaff = (await payload.create({
      collection: 'platformStaff',
      data: {
        email: normalizedEmail,
        firstName,
        lastName,
        role: 'admin',
        supabaseUserId: supabaseUser.id,
      },
      context: {
        trustedPlatformStaffOps: true,
      },
      overrideAccess: true,
    })) as PlatformStaff
  }
}
