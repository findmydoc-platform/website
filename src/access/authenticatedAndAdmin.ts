import type { Access } from 'payload' // Corrected import path
import type { BasicUser, Patient } from '@/payload-types' // Import specific user types if needed

// Define a type for the user object which can be BasicUser or Patient
type User = (BasicUser & { collection: 'basicUsers' }) | (Patient & { collection: 'patients' })

// Check if the user is authenticated and is a Platform Staff member (considered admin)
// Corrected Access type usage - it typically takes 0 or 1 generic for the document type, not the user type.
// The user type is handled within the function logic via req.user.
export const authenticatedAndAdmin: Access = ({ req: { user } }) => {
  const typedUser = user as User | undefined
  return Boolean(typedUser && typedUser.collection === 'basicUsers' && typedUser.userType === 'platform')
}
