import type { Preview } from '@storybook/react'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/700.css'
import './storybook.css'
import '../src/app/(frontend)/globals.css'

if (typeof globalThis !== 'undefined' && typeof (globalThis as Record<string, unknown>).global === 'undefined') {
  ;(globalThis as Record<string, unknown>).global = globalThis
}

const preview: Preview = {
  decorators: [(Story) => <Story />],
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
