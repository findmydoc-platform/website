import type { Decorator } from '@storybook/nextjs-vite'
import { useEffect, useRef } from 'react'

export const createMockFetchDecorator =
  (mockFetch: typeof fetch, setup?: () => void): Decorator =>
  (Story, context) => {
    const originalFetch = useRef(globalThis.fetch)

    useEffect(() => {
      if (setup) {
        setup()
      }
      globalThis.fetch = mockFetch
      return () => {
        globalThis.fetch = originalFetch.current
      }
    }, [])

    return <Story {...context} />
  }
