import React from 'react'
import type { Decorator } from '@storybook/react'
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime'
import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'

const createMockRouter = (overrides?: Partial<AppRouterInstance>): AppRouterInstance => ({
  back: () => {},
  forward: () => {},
  refresh: () => {},
  push: () => {},
  replace: () => {},
  prefetch: () => {},
  ...overrides,
})

export const withMockRouter: Decorator = (Story, context) => {
  const router = createMockRouter()

  return (
    <AppRouterContext.Provider value={router}>
      <Story {...context} />
    </AppRouterContext.Provider>
  )
}
