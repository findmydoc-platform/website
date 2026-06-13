import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { BeforeAfterCaseGallerySection } from '@/components/organisms/ClinicDetail'

const meta = {
  title: 'Domain/Clinic/Templates/ClinicDetail/BeforeAfter Case Gallery',
  component: BeforeAfterCaseGallerySection,
  args: {
    entries: [],
    variant: 'spotlightQueue',
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Empty case-gallery state for visual QA while public before/after examples remain outside the MVP-safe Storybook fixture set.',
      },
    },
  },
  tags: ['autodocs', 'domain:clinic', 'layer:template', 'status:stable', 'used-in:route:/clinics/[slug]'],
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
    await expect(canvas.getByText('No before and after stories published yet.')).toBeInTheDocument()
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
    await expect(canvas.getByText('No before and after stories published yet.')).toBeInTheDocument()
  },
}
