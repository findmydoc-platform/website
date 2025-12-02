import type { Preview } from '@storybook/nextjs-vite'
import { DM_Sans } from 'next/font/google'
import React from 'react'
import '../src/app/(frontend)/globals.css'

if (typeof globalThis !== 'undefined' && typeof (globalThis as Record<string, unknown>).global === 'undefined') {
  ;(globalThis as Record<string, unknown>).global = globalThis
}

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const preview: Preview = {
  decorators: [
    (Story) => (
      <div className={dmSans.variable}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    nextjs: {
      appDirectory: true,
    },
    options: {
      storySort: {
        order: ['Atoms', 'Molecules', 'Organisms', 'Templates', 'Pages', '*'],
      },
    },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },

    a11y: {
      // 'todo' - show a11y violations in the test UI only
      // 'error' - fail CI on a11y violations
      // 'off' - skip a11y checks entirely
      test: 'todo',
    },
  },
}

export default preview
