import type { Decorator } from '@storybook/react-vite'
import { useLayoutEffect } from 'react'

export const createMockFetchDecorator =
  (mockFetch: typeof fetch, setup?: () => void): Decorator =>
  (Story, context) => {
    useLayoutEffect(() => {
      if (setup) {
        setup()
      }
      const original = globalThis.fetch
      globalThis.fetch = mockFetch
      return () => {
        globalThis.fetch = original
      }
    }, [])

    return <Story {...context} />
  }
