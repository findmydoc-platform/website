import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { within, userEvent, waitFor } from '@storybook/testing-library'
import { expect } from '@storybook/jest'
import React from 'react'
import { vi } from 'vitest'

import { AdminBar } from '@/components/organisms/AdminBar'
import { withMockRouter } from '../utils/routerDecorator'

vi.mock('payload-admin-bar', () => ({
  PayloadAdminBar: ({ onAuthChange, logo }: { onAuthChange?: (user: { id?: string } | null) => void; logo?: React.ReactNode }) => {
    React.useEffect(() => {
      onAuthChange?.({ id: 'user-1' })
    }, [onAuthChange])

    return (
      <div className="flex items-center gap-2">
        <div>{logo}</div>
        <button type="button" onClick={() => onAuthChange?.({ id: 'user-1' })}>
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
  }
})

const meta = {
  title: 'Organisms/AdminBar',
  component: AdminBar,
  decorators: [withMockRouter],
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
      expect(adminBar).toHaveClass('block')
    })

    await userEvent.click(canvas.getByRole('button', { name: /log out/i }))

    await waitFor(() => {
      expect(adminBar).toHaveClass('hidden')
    })
  },
}
