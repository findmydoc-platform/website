import type { Access } from 'payload'

export const authenticatedOrApprovedClinic: Access = ({ req: { user } }) => {
  if (user) {
    return true
  }

  return {
    status: {
      equals: 'approved',
    },
  }
}
