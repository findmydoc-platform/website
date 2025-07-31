import configPromise from '@payload-config'
import { getPayload } from 'payload'

/**
 * Fetch a PayloadCMS form by slug
 */
export async function getForm(slug: string) {
  let payload;
  
  try {
    payload = await getPayload({ config: configPromise })
    
    payload.logger.info(`Attempting to fetch form with slug: ${slug}`)
    
    const result = await payload.find({
      collection: 'forms',
      where: {
        slug: {
          equals: slug,
        },
      },
      limit: 1,
      depth: 1,
    })

    if (!result.docs.length) {
      payload.logger.warn(`Form not found with slug: ${slug}`)
      return null
    }

    const form = result.docs[0]
    if (!form) {
      payload.logger.warn(`Form not found with slug: ${slug}`)
      return null
    }
    
    payload.logger.info(`Successfully retrieved form: ${form.title} (ID: ${form.id})`)
    return form
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    
    if (payload) {
      payload.logger.error(`Failed to fetch form with slug ${slug}:`, {
        error: errorMessage,
        slug,
        stack: error instanceof Error ? error.stack : undefined,
      })
    } else {
      console.error(`Failed to initialize payload for form lookup with slug ${slug}:`, errorMessage)
    }
    
    throw new Error(`Unable to retrieve form. Please ensure the form exists and try again.`)
  }
}
