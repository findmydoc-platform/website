import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Hydrates a Supabase client session from access and refresh tokens present in the URL hash.
 *
 * This is used for flows like email invites where Supabase redirects to the app with
 * `#access_token` and `#refresh_token` in the URL instead of setting cookies directly.
 */
export async function hydrateSessionFromHash(supabase: SupabaseClient): Promise<void> {
  if (typeof window === 'undefined') return

  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash
  if (!hash) return

  const params = new URLSearchParams(hash)
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')

  if (!accessToken || !refreshToken) return

  await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })

  // Clean up the hash so tokens are not kept in the URL bar.
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
}
