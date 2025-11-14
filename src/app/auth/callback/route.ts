import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/auth/utilities/supaBaseServer'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/auth/password/reset/complete'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      // Redirect to error page with error details
      return NextResponse.redirect(`${requestUrl.origin}/auth/password/reset/complete?error=${error.message}`)
    }
  }

  // URL to redirect to after code exchange
  return NextResponse.redirect(`${requestUrl.origin}${next}`)
}
