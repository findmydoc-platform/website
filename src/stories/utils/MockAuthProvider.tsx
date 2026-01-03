import React from 'react'
import { AuthProvider } from '@payloadcms/ui'
import type { ClientUser } from 'payload'

interface MockAuthProviderProps {
  children: React.ReactNode
  user?: Partial<ClientUser> | null
}

export const MockAuthProvider: React.FC<MockAuthProviderProps> = ({ children, user }) => {
  // We cast user to ClientUser because the mock might be partial
  return <AuthProvider user={user as ClientUser | null}>{children}</AuthProvider>
}
