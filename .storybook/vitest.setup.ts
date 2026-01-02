import { vi } from 'vitest'
import React from 'react'
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview'
import { setProjectAnnotations } from '@storybook/react'
import * as projectAnnotations from './preview'

// Expose React globally for JSX
;(window as any).React = React

// Polyfill process.env
if (typeof process === 'undefined') {
  ;(window as any).process = {
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
vi.mock('@payloadcms/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@payloadcms/ui')>()
  const React = await import('react')

  const AuthContext = React.createContext({ user: null, setUser: () => {} })

  const AuthProvider = ({ children, user }: any) => {
    return React.createElement(AuthContext.Provider, { value: { user, setUser: () => {} } }, children)
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
