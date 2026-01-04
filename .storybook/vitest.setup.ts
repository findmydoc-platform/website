import { vi } from 'vitest'
import React from 'react'
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview'
import { setProjectAnnotations } from '@storybook/react'
import * as projectAnnotations from './preview'

// Expose React globally for JSX
const windowWithReact = window as unknown as { React?: unknown }
windowWithReact.React = React

// Polyfill process.env
if (typeof process === 'undefined') {
  const windowWithProcess = window as unknown as { process?: { env?: Record<string, string> } }
  windowWithProcess.process = {
    env: {
      NODE_ENV: 'test',
    },
  }
}

// Mock next/font/google
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

// Mock next/navigation
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
// We intentionally stub AuthProvider/useAuth to provide a minimal API surface for tests.
// This avoids coupling tests to Payload's internal implementation details or Next.js router context,
// which are not relevant for component isolation.
vi.mock('@payloadcms/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@payloadcms/ui')>()

  type AuthContextValue = {
    user: unknown
    setUser: (user: unknown) => void
  }

  type AuthProviderProps = {
    children?: React.ReactNode
    user?: unknown
  }

  const AuthContext = React.createContext<AuthContextValue>({
    user: null,
    setUser: () => {
      // no-op in Storybook tests
    },
  })

  const AuthProvider = ({ children, user }: AuthProviderProps) => {
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

// This is an important step to apply the right configuration when testing your stories.
// More info at: https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest#setprojectannotations
setProjectAnnotations([a11yAddonAnnotations, projectAnnotations])
