import React, { useLayoutEffect } from 'react'
import type { Decorator } from '@storybook/react-vite'

export const createMockFetchDecorator = (mockFactory: (originalFetch: typeof fetch) => typeof fetch): Decorator => {
  const MockFetchDecorator: Decorator = (Story) => {
    useLayoutEffect(() => {
      const originalFetch = globalThis.fetch
      const boundOriginal = originalFetch.bind(globalThis)
      globalThis.fetch = mockFactory(boundOriginal)

      return () => {
        globalThis.fetch = originalFetch
      }
    }, [])

    return <Story />
  }
  return MockFetchDecorator
}
