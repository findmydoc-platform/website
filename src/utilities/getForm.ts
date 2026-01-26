/**
 * Fetch a PayloadCMS form by slug from the API.
 *
 * @param slug - Form slug to search for
 * @returns Form document with id, fields, etc.
 * @throws Error if request fails or form is not found
 *
 * @example
 * const contactForm = await getForm('contact-us')
 * // Returns form document with fields configuration
 */
export async function getForm(slug: string) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL || ''}/api/forms?where[slug][equals]=${slug}`)

  if (!res.ok) {
    throw new Error('Could not load form')
  }

  const { docs } = await res.json()
  if (!docs.length) {
    throw new Error('Form not found')
  }

  return docs[0] // contains id, fields, etc.
}
