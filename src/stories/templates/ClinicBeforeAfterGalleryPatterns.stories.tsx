import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import { BeforeAfterCaseGallerySection } from '@/components/organisms/ClinicDetail'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'

const meta = {
  title: 'Templates/ClinicDetail/BeforeAfter Case Gallery',
  component: BeforeAfterCaseGallerySection,
  args: {
    entries: clinicDetailFixture.beforeAfterEntries,
    variant: 'spotlightQueue',
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Unified before/after case gallery with two functional variants controlled by a single `variant` prop.',
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof BeforeAfterCaseGallerySection>

export default meta

type Story = StoryObj<typeof meta>

export const SpotlightQueue: Story = {
  args: {
    variant: 'spotlightQueue',
  },
  render: (args) => (
    <div className="bg-muted py-14">
      <div className="container-content">
        <BeforeAfterCaseGallerySection {...args} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const queueItem = canvas.getByRole('button', { name: /Open case 2:/ })

    await userEvent.click(queueItem)
    await expect(queueItem).toHaveAttribute('aria-current', 'true')
  },
}

export const SpotlightQueueReveal: Story = {
  args: {
    variant: 'spotlightQueueReveal',
  },
  render: (args) => (
    <div className="bg-muted py-14">
      <div className="container-content">
        <BeforeAfterCaseGallerySection {...args} />
      </div>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const queueItem = canvas.getByRole('button', { name: /Open case 2:/ })

    await userEvent.click(queueItem)
    await expect(queueItem).toHaveAttribute('aria-current', 'true')

    const afterButton = canvas.getByRole('button', { name: 'After' })
    await userEvent.click(afterButton)
    await expect(canvas.getByRole('slider', { name: 'Before and after comparison slider' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
  },
}
