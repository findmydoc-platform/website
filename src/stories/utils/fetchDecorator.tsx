import type { Decorator } from '@storybook/react-vite'
import { useEffect, useRef } from 'react'

export const createMockFetchDecorator =
  (mockFetch: typeof fetch, setup?: () => void): Decorator =>
  (Story, context) => {
    const originalFetch = useRef(globalThis.fetch)

    useEffect(() => {
      if (setup) {
        setup()
      }
      const original = originalFetch.current
      globalThis.fetch = mockFetch
      return () => {
        globalThis.fetch = original
      }
    }, [])

    return <Story {...context} />
  }
