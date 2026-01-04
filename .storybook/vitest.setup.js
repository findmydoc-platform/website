import React from 'react'
import { vi } from 'vitest'
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview'
import { setProjectAnnotations } from '@storybook/react'
import * as projectAnnotations from './preview'

// Expose React globally for JSX
if (typeof window !== 'undefined') {
  window.React = React

  // Polyfill process.env for browser-only code paths
  if (typeof process === 'undefined') {
    window.process = { env: { NODE_ENV: 'test' } }
  }
}

vi.mock('next/font/google', () => ({
  DM_Sans: () => ({
    variable: 'dm-sans-mock',
    className: 'dm-sans-mock-class',
    style: { fontFamily: 'DM Sans' },
  }),
  Inter: () => ({
    variable: 'inter-mock',
    className: 'inter-mock-class',
    style: { fontFamily: 'Inter' },
  }),
  Roboto: () => ({
    variable: 'roboto-mock',
    className: 'roboto-mock-class',
    style: { fontFamily: 'Roboto' },
  }),
}))

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual('next/navigation')
  return {
    ...actual,
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }),
    usePathname: () => '/',
    useSearchParams: () => new URLSearchParams(),
    useSelectedLayoutSegment: () => null,
    useSelectedLayoutSegments: () => [],
    redirect: vi.fn(),
    notFound: vi.fn(),
  }
})

// Mock @payloadcms/ui to avoid Next.js router dependency in AuthProvider
vi.mock('@payloadcms/ui', async (importOriginal) => {
  const actual = await importOriginal()

  const AuthContext = React.createContext({
    user: null,
    setUser: () => {
      // no-op in Storybook tests
    },
  })

  const AuthProvider = ({ children, user }) => {
    return React.createElement(
      AuthContext.Provider,
      {
        value: {
          user: user ?? null,
          setUser: () => {
            // no-op in Storybook tests
          },
        },
      },
      children,
    )
  }

  const useAuth = () => React.useContext(AuthContext)

  return {
    ...actual,
    AuthProvider,
    useAuth,
  }
})

setProjectAnnotations([a11yAddonAnnotations, projectAnnotations])
