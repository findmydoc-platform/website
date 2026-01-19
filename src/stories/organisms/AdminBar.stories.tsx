import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'
import React from 'react'
import { vi } from 'vitest'
import type { PayloadAdminBarProps } from 'payload-admin-bar'

import { AdminBar } from '@/components/organisms/AdminBar'

vi.mock('payload-admin-bar', () => ({
  PayloadAdminBar: (props: PayloadAdminBarProps) => {
    const { onAuthChange, logo } = props
    React.useEffect(() => {
      onAuthChange?.({ id: 'user-1', email: 'test@example.com' })
    }, [onAuthChange])

    return (
      <div className="flex items-center gap-2">
        <div>{logo}</div>
        <button type="button" onClick={() => onAuthChange?.({ id: 'user-1', email: 'test@example.com' })}>
          Log in
        </button>
        <button type="button" onClick={() => onAuthChange?.(null)}>
          Log out
        </button>
      </div>
    )
  },
}))

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation')

  return {
    ...actual,
    useSelectedLayoutSegments: () => ['admin', 'pages'],
    useRouter: () => ({
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    }),
  }
})

const meta = {
  title: 'Organisms/AdminBar',
  component: AdminBar,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'test'],
} satisfies Meta<typeof AdminBar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await waitFor(() => {
      expect(canvas.getByRole('button', { name: /log out/i })).toBeInTheDocument()
    })

    const adminBar = canvasElement.querySelector('.admin-bar')

    expect(adminBar).toBeInTheDocument()
    await waitFor(() => {
      expect(adminBar).toBeVisible()
    })

    await userEvent.click(canvas.getByRole('button', { name: /log out/i }))

    await waitFor(() => {
      expect(adminBar).not.toBeVisible()
    })
  },
}
