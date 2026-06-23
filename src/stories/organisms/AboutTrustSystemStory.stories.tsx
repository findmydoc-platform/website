import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from 'storybook/test'

import { AboutTrustSystemStory } from '@/components/organisms/AboutTrustSystemStory'
import { withViewportStory } from '../utils/viewportMatrix'

const meta = {
  title: 'Domain/Landing/Organisms/AboutTrustSystemStory',
  component: AboutTrustSystemStory,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Isolated trust-system scroll story prepared for the About page. The route integration is intentionally handled in a later step.',
      },
    },
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:experimental', 'used-in:route:/about'],
} satisfies Meta<typeof AboutTrustSystemStory>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('region', { name: /findmydoc trust system scroll story/i })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Patients start with uncertainty.' })).toBeInTheDocument()
    await expect(
      canvas.getByRole('heading', { name: 'We turn trust signals into clearer decisions.' }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole('heading', { name: 'A clearer path forward for patients and clinics.' }),
    ).toBeInTheDocument()
    await expect(canvas.getByText(/Patient\s*Confidence/)).toBeInTheDocument()
    await expect(canvas.getByText('Trust at the core')).toBeInTheDocument()
    await expect(canvas.queryByText(/Reusable argumentation/i)).not.toBeInTheDocument()
  },
}

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')
export const Default320Short: Story = withViewportStory(Default, 'public320Short', 'Default / 320 short')
export const Default375Short: Story = withViewportStory(Default, 'public375Short', 'Default / 375 short')
