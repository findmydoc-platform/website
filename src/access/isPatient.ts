import type { Access } from 'payload'

// Check if the user is authenticated and is a patient
export const isPatient: Access = ({ req: { user } }) => {
  return Boolean(user && user.collection === 'patients')
}

// Check if the user is a patient and owns the document
export const isOwnPatient: Access = ({ req: { user }, id }) => {
  if (!user || user.collection !== 'patients') return false

  if (id) {
    return user.id === id
  }

  return {
    id: {
      equals: user.id,
    },
  }
}
