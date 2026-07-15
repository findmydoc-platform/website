import type { Access } from 'payload' // Corrected import path
import type { Patient, PlatformStaff } from '@/payload-types'

type User = (PlatformStaff & { collection: 'platformStaff' }) | (Patient & { collection: 'patients' })

// Check if the user is authenticated and is a Platform Staff member (considered admin)
// Corrected Access type usage - it typically takes 0 or 1 generic for the document type, not the user type.
// The user type is handled within the function logic via req.user.
export const authenticatedAndAdmin: Access = ({ req: { user } }) => {
  const typedUser = user as User | undefined
  return Boolean(typedUser && typedUser.collection === 'platformStaff')
}
