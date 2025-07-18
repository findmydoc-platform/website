/**
 * Fetch a PayloadCMS form by slug
 */
export async function getForm(slug: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL || ''}/api/forms?where[slug][equals]=${slug}`
  )

  if (!res.ok) {
    throw new Error('Could not load form')
  }

  const { docs } = await res.json()
  if (!docs.length) {
    throw new Error('Form not found')
  }

  return docs[0] // contains id, fields, etc.
}
