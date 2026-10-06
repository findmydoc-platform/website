import { createClient, type User } from '@supabase/supabase-js'
import { z } from 'zod'

function configuration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Auth-action protocol unavailable.')
  return { url, key }
}

export async function verifyProtocolUser(accessToken: string): Promise<User | null> {
  const { url, key } = configuration()
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, cache: 'no-store', signal: AbortSignal.timeout(10_000) }),
    },
  })
  const { data, error } = await client.auth.getUser(accessToken)
  if (error) {
    if (error.status && [400, 401, 403, 404].includes(error.status)) return null
    throw new Error('Auth-action protocol unavailable.')
  }
  return data.user
}

/** One ordinary authenticated PUT, with no automatic retry or Admin password mutation. */
export async function updateProtocolPassword(accessToken: string, password: string) {
  const { url, key } = configuration()
  const response = await fetch(new URL('/auth/v1/user', url), {
    method: 'PUT',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    headers: { apikey: key, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  const body: unknown = await response.json()
  if (!response.ok) {
    const detail = z.object({ code: z.string().optional(), error_code: z.string().optional() }).safeParse(body)
    return {
      data: { user: null },
      error: {
        status: response.status,
        code: detail.success ? (detail.data.code ?? detail.data.error_code) : undefined,
      },
    }
  }
  const identity = z.object({ id: z.uuid() }).safeParse(body)
  if (!identity.success) throw new Error('Auth-action protocol unavailable.')
  return { data: { user: body as User }, error: null }
}

/** One ordinary password login. Its session exists only for server-verified initial completion evidence. */
export async function authenticateProtocolPassword(email: string, password: string) {
  const { url, key } = configuration()
  const response = await fetch(new URL('/auth/v1/token?grant_type=password', url), {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const body: unknown = await response.json()
  const session = z
    .object({ access_token: z.string().min(1).max(8192), user: z.object({ id: z.uuid() }) })
    .safeParse(body)
  if (!response.ok || !session.success) throw new Error('Auth-action protocol unavailable.')
  return { accessToken: session.data.access_token, subject: session.data.user.id }
}
