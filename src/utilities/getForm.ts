import type { Form } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

type SameOriginRequestContext = {
  headers: {
    authorization?: string
    cookie?: string
  }
  origin: string
}

/**
 * Fetch a PayloadCMS form by slug.
 *
 * @param slug - Form slug value
 * @returns Form document with id, fields, etc. or null when no form exists
 * @throws Error if request fails
 */
export async function getForm(slug: string, requestContext?: SameOriginRequestContext): Promise<Form | null> {
  const baseUrl = requestContext?.origin ?? getServerSideURL()
  const trimmedSlug = slug.trim()

  if (!trimmedSlug) {
    return null
  }

  const requestURL = new URL('/api/forms', baseUrl)
  requestURL.searchParams.set('where[slug][equals]', trimmedSlug)
  requestURL.searchParams.set('limit', '1')
  requestURL.searchParams.set('depth', '0')

  const authHeaders: Record<string, string> = {}
  if (requestContext?.headers.authorization) authHeaders.Authorization = requestContext.headers.authorization
  if (requestContext?.headers.cookie) authHeaders.Cookie = requestContext.headers.cookie

  const response =
    Object.keys(authHeaders).length > 0
      ? await fetch(requestURL.toString(), { cache: 'no-store', headers: authHeaders })
      : await fetch(requestURL.toString())

  if (!response.ok) {
    throw new Error('Could not load form')
  }

  const body = (await response.json()) as { docs?: Form[] }
  const docs = Array.isArray(body.docs) ? body.docs : []

  return docs[0] ?? null
}
