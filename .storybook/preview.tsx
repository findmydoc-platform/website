import type { Preview } from '@storybook/react'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/700.css'
import './storybook.css'
import '../src/app/(frontend)/globals.css'

import { DemoFrame, type DemoFrameProps } from '../src/stories/_helpers/DemoFrame'

if (typeof globalThis !== 'undefined' && typeof (globalThis as Record<string, unknown>).global === 'undefined') {
  ;(globalThis as Record<string, unknown>).global = globalThis
}

function isDemoFrameMaxWidth(value: unknown): value is NonNullable<DemoFrameProps['maxWidth']> {
  return (
    value === 'xs' ||
    value === 'sm' ||
    value === 'md' ||
    value === 'lg' ||
    value === 'xl' ||
    value === '2xl' ||
    value === 'full'
  )
}

function getDemoFrameParams(parameters: unknown): Partial<DemoFrameProps> | false {
  if (parameters === false) return false
  if (typeof parameters !== 'object' || parameters === null) return {}

  const record = parameters as Record<string, unknown>
  const maxWidth = isDemoFrameMaxWidth(record.maxWidth) ? record.maxWidth : undefined
  const padded = typeof record.padded === 'boolean' ? record.padded : undefined
  const className = typeof record.className === 'string' ? record.className : undefined

  return { maxWidth, padded, className }
}

const preview: Preview = {
  decorators: [
    (Story, context) => {
      const title = context.title ?? ''
      const isAtomOrMolecule = title.startsWith('Atoms/') || title.startsWith('Molecules/')
      const demoFrame = getDemoFrameParams((context.parameters as Record<string, unknown>)?.demoFrame)

      const content =
        isAtomOrMolecule && demoFrame !== false ? (
          <DemoFrame maxWidth="md" {...demoFrame}>
            <Story />
          </DemoFrame>
        ) : (
          <Story />
        )

      return (
        <div className="bg-background text-foreground min-h-svh">
          <div className="container-content">{content}</div>
        </div>
      )
    },
  ],
  parameters: {
    layout: 'fullscreen',
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
