import '@testing-library/jest-dom/vitest'
import React from 'react'
import { vi } from 'vitest'
import * as a11yAddonAnnotations from '@storybook/addon-a11y/preview'
import { setProjectAnnotations } from '@storybook/react'
import { imageConfigDefault } from 'next/dist/shared/lib/image-config'
import { IMAGE_LOCAL_PATTERNS, IMAGE_QUALITIES, applyNextImageConfigGlobals } from '../src/imageConfig.js'

// This file is intentionally JavaScript (not TypeScript).
// In CI, if Vite ever tries to optimize deps and reload during a Vitest Browser run,
// the browser-side loader can choke on TS-only syntax and fail to import the setup file.
// Keeping it JS makes the setup more robust.

// Expose React globally for JSX
if (typeof window !== 'undefined') {
  window.React = React

  // Polyfill process.env for browser-only code paths
  if (typeof process === 'undefined') {
    window.process = { env: { NODE_ENV: 'test' } }
  }
}

const patchedImageConfig = JSON.parse(JSON.stringify(imageConfigDefault))
patchedImageConfig.localPatterns = IMAGE_LOCAL_PATTERNS
patchedImageConfig.qualities = IMAGE_QUALITIES

applyNextImageConfigGlobals(patchedImageConfig)

const projectAnnotations = await import('./preview')

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
  // Avoid object spread here to keep this file usable even if it is loaded
  // without modern syntax transforms.
  return Object.assign({}, actual, {
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
  })
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
          user: user == null ? null : user,
          setUser: () => {
            // no-op in Storybook tests
          },
        },
      },
      children,
    )
  }

  const useAuth = () => React.useContext(AuthContext)

  // Avoid object spread for the same reason as above.
  return Object.assign({}, actual, { AuthProvider: AuthProvider, useAuth: useAuth })
})

setProjectAnnotations([a11yAddonAnnotations, projectAnnotations])
