import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers.js'

// Common configuration for createServerClient
const getSupabaseConfig = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined')
  }
  if (!key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not defined')
  }

  return { url, key }
}

export async function createClient() {
  const { url, key } = getSupabaseConfig()
  const cookieStore = await cookies()
  // console.debug('createClient cookies:', cookieStore.getAll().map(c => c.name))
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {}
      },
    },
  })
}

/** Verify a callback token before allowing its returned identity to write browser session cookies. */
export function createVerificationClient() {
  const { url, key } = getSupabaseConfig()
  let pendingCookies: { name: string; value: string; options: CookieOptions }[] = []
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => [],
      setAll: (values) => {
        pendingCookies = values
      },
    },
  })
  return {
    auth: client.auth,
    async commitSession() {
      const store = await cookies()
      pendingCookies.forEach(({ name, value, options }) => store.set(name, value, options))
      pendingCookies = []
    },
  }
}

// Create a Supabase admin client for server-side admin operations
export async function createAdminClient(signal?: AbortSignal) {
  const { url } = getSupabaseConfig()
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not defined')
  }

  return createServerClient(url, serviceRoleKey, {
    ...(signal ? { global: { fetch: (input, init) => fetch(input, { ...init, signal }) } } : {}),
    cookies: {
      getAll() {
        return []
      },
      setAll() {
        // Admin client doesn't need cookie management
      },
    },
  })
}
