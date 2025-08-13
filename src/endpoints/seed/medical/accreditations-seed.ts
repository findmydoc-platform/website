import { Payload } from 'payload'
import { upsertByUniqueField, createMediaFromBase64 } from '../seed-helpers'

/**
 * Seed healthcare accreditations idempotently.
 * @param payload Payload instance
 * @returns created / updated aggregate counts
 */
export async function seedAccreditations(payload: Payload): Promise<{ created: number; updated: number }> {
  payload.logger.info('— Seeding accreditations (idempotent)...')

  // Base64 image data for JCI logo
  const jciLogoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABoAAAAVCAYAAABYHP4bAAADxElEQVR4AbyTzWsjZRzHPzOZTJr3pk2aNpu2bpstLkW7xe4uiicpuCpIwYugFy9lQVARFbx50KN/g5c9eBDEPXkRXFZU0EUUt1vapO+2TdI2ycxkJslkZnzaveVl29N+D88wz/P7PZ/f2yN7T0dbMk9JFwZ5gottFjHLD6iX/qSpb+C6rQuHeS7IdRpUNu5S+PEdVn9YYv2nj8j//Ck7999n/9dlalt3cFpH5wKfAPKwrTLb9z5h+5cv2Nnc4OG2zLHmoVniW/P4d7VM4e+7aPmvadf/eSKsL6jd0ti+/zkH+d/ZPIThdILFxRnm5qeYnowifpmZkJF98HBlC6v4PW5jpS+sJ8h1mhw9+pbjnQfUGgo3X8wxe2OWxGiCyOAAwYiKIjvYeomwc8ilMT/5jV0c8x6uU+sJ6wHycJo1jlfv0HRVruQGGR6LI7kWsrD2hQYJxFIEEyMEY0k8VwzJ8R6xmJ/CozU8/beLgTzXwSj+Qd1qYXsqQ4MRPMvAtZu0LIv99Tyrf61Q2DiiWi6xt6+h6xb2SZHaUYWWvo7nOV0wEWPHnhjjRjWPZatEwjJNs0qzboiyWCLTBmZTYiCZYepKBkuKMnZ5kmQqSrth4JdN9ON9WvUSneoG4YFjEI/7iEUU6oaOXnfQ9DalUgPPFySdDFKutrk0kyN7eVSUMI6q+omoNpZWEdBqJwe5a0eS8AUi+NUAPkWmYVgYlRp7u0VKxRNCislWfo9EXGEsHSIQDqNG4iIAhaahYTcsPMlPp7pBgh2MT3Ha+Xg8hOO4HJU1KicGqajI6rDKSDJEUmSMYyPiAp8fo95Cr1ZFfxQBztCpLpAk+wim5smODxJJRIin0zgti9FYSzxgg0jAYTDYFm/GxBX7ttVAq2q4RploUEEJTaIGQp0cukAgidKlGBh5hQFRlsz0FEOjSdqtxhkw7G+K6asLaJ1G3eSoWOa/tQIBz0TyJ4k98wa91AMEkqziTy3RllKsbdskctfwjeSo6g6WbmJodQ5ECVdX9tld28E5zaoZJzx+i+HxF+ilniBEVrJ/GDm9TGZigs1tEzmaJTv3EnZihrK4VLcUvLaLVnOwmj7SV5eYuH6bfuoDEuaSjD84IUrxIXPXFwkoEgf7FUzttCcOhcIJtZMaQyNZZl/9ktzLn+ETQ0Ef9QedOUgo6jDR7Ltkr31FbuE22atvMv3869y89QHzb33DwtvfkXn2NSRJOvPot5wDeuwmiewC4RRD44tknltm8sbHTMy/R3J8AZ+iPjY6Z70Q6Jw7LnT8PwAAAP//fWPJxAAAAAZJREFUAwBe8ATCOXIGtwAAAABJRU5ErkJggg=='

  // Create or find the JCI logo media
  let jciIcon
  try {
    // Check if the media already exists
    const existingMedia = await payload.find({
      collection: 'media',
      where: { filename: { equals: 'jci-logo.png' } },
      limit: 1,
    })

    if (existingMedia.totalDocs > 0) {
      jciIcon = existingMedia.docs[0]
      payload.logger.info('— JCI logo already exists, reusing...')
    } else {
      // Create the media from base64 data
      jciIcon = await createMediaFromBase64(
        payload,
        jciLogoBase64,
        'jci-logo.png',
        'Joint Commission International Logo'
      )
      payload.logger.info('— Created JCI logo media')
    }
  } catch (error) {
    payload.logger.error('— Failed to create JCI logo media:', error)
    jciIcon = null
  }

  const accreditations = [
    {
      name: 'Joint Commission International',
      abbreviation: 'JCI',
      country: 'United States',
      description: 'Goldstandard für internationale Gesundheitsversorgung, Schwerpunkt auf Patientensicherheit und Qualitätsverbesserung',
      icon: jciIcon?.id || null,
    },
  ]

  let created = 0
  let updated = 0

  for (const accreditation of accreditations) {
    const res = await upsertByUniqueField(payload, 'accreditation', 'name', accreditation)
    if (res.created) created++
    if (res.updated) updated++
  }

  payload.logger.info('— Finished seeding accreditations.')
  return { created, updated }
}