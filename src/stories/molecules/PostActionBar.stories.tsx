import type { Meta, StoryObj } from '@storybook/react-vite'
import { PostActionBar } from '@/components/molecules/PostActionBar'
import { userEvent, within, expect, fn } from '@storybook/test'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Domain/Blog/Molecules/PostActionBar',
  component: PostActionBar,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs', 'domain:blog', 'layer:molecule', 'status:stable', 'used-in:route:/posts/[slug]'],
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

const mobileDenseBase: Story = {
  args: {
    backLink: {
      label: 'Back to treatment planning overview',
      href: '/posts',
    },
    shareButton: {
      label: 'Share article',
      onClick: fn(),
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Back to treatment planning overview' })).toBeInTheDocument()
    const shareButton = canvas.getByRole('button', { name: 'Share article' })
    await userEvent.click(shareButton)
    await expect(args.shareButton?.onClick).toHaveBeenCalled()
  },
}

export const MobileDense320: Story = withViewportStory(mobileDenseBase, 'public320', 'Mobile dense / 320')
export const MobileDense375: Story = withViewportStory(mobileDenseBase, 'public375', 'Mobile dense / 375')
export const MobileDense640: Story = withViewportStory(mobileDenseBase, 'public640', 'Mobile dense / 640')
export const MobileDense768: Story = withViewportStory(mobileDenseBase, 'public768', 'Mobile dense / 768')
export const MobileDense1024: Story = withViewportStory(mobileDenseBase, 'public1024', 'Mobile dense / 1024')
export const MobileDense1280: Story = withViewportStory(mobileDenseBase, 'public1280', 'Mobile dense / 1280')
export const MobileDense375Short: Story = withViewportStory(
  mobileDenseBase,
  'public375Short',
  'Mobile dense / 375 short',
)
