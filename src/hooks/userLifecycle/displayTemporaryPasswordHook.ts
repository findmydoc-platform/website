import type { CollectionAfterChangeHook } from 'payload'
import type { BasicUser } from '../../payload-types'

/**
 * Hook that displays temporary passwords for admin-created BasicUsers.
 * This runs after user creation to show the password that was generated
 * during Supabase user creation.
 */
export const displayTemporaryPasswordHook: CollectionAfterChangeHook<BasicUser> = async ({ doc, operation, req }) => {
  // Only run on user creation
  if (operation !== 'create') {
    return doc
  }

  // Check if we have a temporary password (either from context or the saved doc)
  const temporaryPassword = req.context?.temporaryPassword || doc.temporaryPassword

  if (temporaryPassword && doc.email) {
    const { payload } = req

    // Log a concise warning for admin
    payload.logger.warn(`🔑 Temporary password generated for user (${doc.email}). Check the admin panel for details.`)

    // Log structured data for better admin experience
    payload.logger.info('New user created with temporary password', {
      userId: doc.id,
      email: doc.email,
      userType: doc.userType,
    })
  }

  return doc
}
