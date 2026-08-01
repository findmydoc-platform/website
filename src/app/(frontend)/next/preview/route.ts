import type { CollectionSlug, PayloadRequest } from 'payload'
import { getPayload } from 'payload'
import type { NextRequest } from 'next/server'
import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'

import configPromise from '@payload-config'
import { sanitizeInternalRedirectPath } from '@/utilities/routing/sanitizeInternalRedirectPath'

/**
 * Route handler to enable Next.js draft (preview) mode for a specific document.
 * Validates a shared secret and requires an authenticated Payload platform staff user.
 * Next.js 15 requires the first arg to be a NextRequest for correct typing.
 */
export async function GET(request: NextRequest): Promise<Response> {
  const payload = await getPayload({ config: configPromise })

  const { searchParams } = new URL(request.url)

  const path = searchParams.get('path')
  const collection = searchParams.get('collection') as CollectionSlug
  const slug = searchParams.get('slug')
  const previewSecret = searchParams.get('previewSecret')

  if (previewSecret !== process.env.PREVIEW_SECRET) {
    return new Response('You are not allowed to preview this page', { status: 403 })
  }

  if (!path || !collection || !slug) {
    return new Response('Insufficient search params', { status: 404 })
  }

  const safePath = sanitizeInternalRedirectPath({
    nextPath: path,
    fallbackPath: '',
  })

  if (!safePath) {
    return new Response('This endpoint can only be used for relative previews', { status: 500 })
  }

  const draft = await draftMode()
  let user

  try {
    const authResult = await payload.auth({
      req: request as unknown as PayloadRequest,
      headers: request.headers,
    })
    user = authResult.user
  } catch (error) {
    payload.logger.error(error, 'Error verifying token for live preview')
    draft.disable()
    return new Response('You are not allowed to preview this page', { status: 403 })
  }

  if (user?.collection !== 'platformStaff') {
    draft.disable()
    return new Response('You are not allowed to preview this page', { status: 403 })
  }

  draft.enable()

  redirect(safePath)
}
