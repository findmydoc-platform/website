import type { Access } from 'payload/types'

// Check if the user is authenticated and is a patient
export const isPatient: Access = ({ req: { user } }) => {
  return Boolean(user && user.collection === 'patients')
}

// Check if the user is a patient and owns the document
export const isOwnPatient: Access = ({ req: { user }, id }) => {
  if (!user || user.collection !== 'patients') return false
  
  // If checking a specific document, verify ownership
  if (id) {
    return user.id === id
  }
  
  // For list operations, restrict to only seeing own document
  return {
    id: {
      equals: user.id,
    },
  }
}
