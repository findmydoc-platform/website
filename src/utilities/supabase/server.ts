import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'

// Common configuration for createServerClient
const getSupabaseConfig = () => ({
  url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
})

export async function getUser(response: NextResponse, request: NextRequest) {
  const { url, key } = getSupabaseConfig()
  const supabaseClient = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        )
      },
    },
  })

  const user = (await supabaseClient.auth.getUser()).data.user
  return user
}

export async function createClient() {
  const { url, key } = getSupabaseConfig()
  const cookieStore = await cookies()
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
