import type { Meta, StoryObj } from '@storybook/react-vite'
import { PostActionBar } from '@/components/molecules/PostActionBar'
import { userEvent, within, expect } from '@storybook/test'

const meta = {
  title: 'Molecules/PostActionBar',
  component: PostActionBar,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PostActionBar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    backLink: {
      label: 'Zurück zum Blog',
      href: '/posts',
    },
    shareButton: {
      label: 'Teilen',
      onClick: async () => {},
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Verify back link is rendered
    const backLink = canvas.getByText('Zurück zum Blog')
    await expect(backLink).toBeInTheDocument()

    // Verify share button is rendered
    const shareButton = canvas.getByText('Teilen')
    await expect(shareButton).toBeInTheDocument()
  },
}

export const CustomLabels: Story = {
  args: {
    backLink: {
      label: 'Alle Artikel',
      href: '/posts',
    },
    shareButton: {
      label: 'Artikel teilen',
      onClick: async () => {},
    },
  },
}

export const DefaultLabels: Story = {
  name: 'With Default Labels',
  args: {
    // Using all defaults - will use "Zurück zum Blog" and "Teilen"
  },
}

export const CustomBackLink: Story = {
  name: 'Custom Back Link Only',
  args: {
    backLink: {
      label: 'Zurück zur Kategorie',
      href: '/posts?category=zahnmedizin',
    },
  },
}

export const InteractiveTest: Story = {
  name: 'Interactive (Hover Effects)',
  args: {
    backLink: {
      label: 'Zurück zum Blog',
      href: '/posts',
    },
    shareButton: {
      label: 'Teilen',
      onClick: async () => {},
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    // Test hover on back link
    const backLink = canvas.getByText('Zurück zum Blog')
    await userEvent.hover(backLink)

    // Test hover on share button
    const shareButton = canvas.getByText('Teilen')
    await userEvent.hover(shareButton)
  },
}
