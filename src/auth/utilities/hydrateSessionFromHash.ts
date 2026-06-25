import type { SupabaseClient } from '@supabase/supabase-js'

const supabaseAuthHashKeys = new Set([
  'access_token',
  'error',
  'error_code',
  'error_description',
  'expires_at',
  'expires_in',
  'refresh_token',
  'type',
])

function hasSupabaseAuthHash(params: URLSearchParams): boolean {
  for (const key of supabaseAuthHashKeys) {
    if (params.has(key)) return true
  }

  return false
}

function clearUrlHash(): void {
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
}

let capturedSupabaseAuthHash: string | null = null

function readSupabaseAuthHashFromUrl(): string | null {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  if (!hash) return null

  const params = new URLSearchParams(hash)
  if (!hasSupabaseAuthHash(params)) return null

  return hash
}

export function captureSupabaseAuthHashFromUrl(): boolean {
  if (typeof window === 'undefined') return false

  const hash = readSupabaseAuthHashFromUrl()
  if (!hash) return false

  capturedSupabaseAuthHash = hash
  clearUrlHash()

  return true
}

function consumeSupabaseAuthHashParams(): URLSearchParams | null {
  captureSupabaseAuthHashFromUrl()

  if (!capturedSupabaseAuthHash) return null

  const params = new URLSearchParams(capturedSupabaseAuthHash)
  capturedSupabaseAuthHash = null

  return params
}

/**
 * Hydrates a Supabase client session from access and refresh tokens present in the URL hash.
 *
 * This is used for flows like email invites where Supabase redirects to the app with
 * `#access_token` and `#refresh_token` in the URL instead of setting cookies directly.
 */
export async function hydrateSessionFromHash(supabase: SupabaseClient): Promise<void> {
  if (typeof window === 'undefined') return

  const params = consumeSupabaseAuthHashParams()
  if (!params) return

  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (!accessToken || !refreshToken) return

  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
}
