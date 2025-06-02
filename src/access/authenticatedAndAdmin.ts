import type { Access } from 'payload' // Corrected import path
import type { BasicUser, Patient } from '@/payload-types' // Import specific user types if needed

// Define a type for the user object which can be BasicUser or Patient
type User = (BasicUser & { collection: 'basicUsers' }) | (Patient & { collection: 'patients' })

// Check if the user is authenticated and is a Platform Staff member (considered admin)
// Corrected Access type usage - it typically takes 0 or 1 generic for the document type, not the user type.
// The user type is handled within the function logic via req.user.
export const authenticatedAndAdmin: Access = ({ req: { user } }) => {
  // Check if user exists and is from the basicUsers collection with type 'platform'
  // Cast user to 'any' temporarily to access properties, as req.user type might be broad
  const typedUser = user as User | undefined
  return Boolean(typedUser && typedUser.collection === 'basicUsers' && typedUser.userType === 'platform')
}

// Note: The original file name was authenticatedAndAdmin.ts, but the exported function was named 'authenticated'.
// I've renamed the function to 'authenticatedAndAdmin' to match the file name and likely intent.
// If the old 'authenticated' function (just checking if user exists) is still needed elsewhere,
// it should be kept or recreated separately.

