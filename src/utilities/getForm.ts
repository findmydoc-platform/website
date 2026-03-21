import type { Form } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'

/**
 * Fetch a PayloadCMS form by slug.
 *
 * @param slug - Form slug value
 * @returns Form document with id, fields, etc. or null when no form exists
 * @throws Error if request fails
 */
export async function getForm(slug: string): Promise<Form | null> {
  const baseUrl = getServerSideURL()
  const trimmedSlug = slug.trim()

  if (!trimmedSlug) {
    return null
  }

  const response = await fetch(
    `${baseUrl}/api/forms?where[slug][equals]=${encodeURIComponent(trimmedSlug)}&limit=1&depth=0`,
  )

  if (!response.ok) {
    throw new Error('Could not load form')
  }

  const body = (await response.json()) as { docs?: Form[] }
  const docs = Array.isArray(body.docs) ? body.docs : []

  return docs[0] ?? null
}
