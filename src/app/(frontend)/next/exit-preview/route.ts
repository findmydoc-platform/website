import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import type { NextRequest } from 'next/server'

import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'

export async function GET(request: NextRequest): Promise<Response> {
  const draft = await draftMode()
  draft.disable()

  const requestedRedirect = request.nextUrl.searchParams.get('redirect')

  if (requestedRedirect) {
    const safeRedirect = sanitizeInternalRedirectPath({
      nextPath: requestedRedirect,
      fallbackPath: '/',
      blockedPaths: ['/next/exit-preview'],
    })

    redirect(safeRedirect)
  }

  return new Response('Draft mode is disabled')
}
