import type { CollectionAfterChangeHook } from 'payload'
import type { BasicUser } from '../../payload-types'

/**
 * Hook that displays temporary passwords for admin-created BasicUsers.
 * This runs after user creation to show the password that was generated
 * during Supabase user creation.
 * 
 * The temporary password is now stored in the temporaryPassword field
 * and will be visible in the PayloadCMS admin interface.
 */
export const displayTemporaryPasswordHook: CollectionAfterChangeHook<BasicUser> = async ({
  doc,
  operation,
  req,
}) => {
  // Only run on user creation
  if (operation !== 'create') {
    return doc
  }

  // Check if we have a temporary password (either from context or the saved doc)
  const temporaryPassword = req.context?.temporaryPassword || doc.temporaryPassword

  if (temporaryPassword && doc.email) {
    const { payload } = req

    // Display prominent message for admin
    payload.logger.warn(`
================================================================================
🔑 TEMPORARY PASSWORD GENERATED FOR NEW USER
================================================================================
Email: ${doc.email}
User Type: ${doc.userType}
Temporary Password: ${temporaryPassword}

✅ PASSWORD IS NOW VISIBLE IN THE ADMIN PANEL
- Check the "Temporary Password" field in the user record
- Share this password securely with the user
- User should change this password on first login
- Consider clearing this field after the user has logged in
================================================================================
    `)

    // Also log structured data for better admin experience
    payload.logger.info('New user created with temporary password', {
      userId: doc.id,
      email: doc.email,
      userType: doc.userType,
      message: 'Password visible in admin panel - share securely with user',
    })
  }

  return doc
}
