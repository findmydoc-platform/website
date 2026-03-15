import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { HoldingPageConcept } from '@/components/templates/HoldingPageConcept'
import { holdingPageConcept } from '@/stories/fixtures/holdingPageConcepts'

const meta = {
  title: 'Templates/HoldingPage',
  component: HoldingPageConcept,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Storybook-only holding page focused on the immersive video hero launch direction.',
      },
    },
  },
  tags: ['autodocs'],
  args: holdingPageConcept,
} satisfies Meta<typeof HoldingPageConcept>

export default meta

type Story = StoryObj<typeof meta>

const assertConceptFrame: Story['play'] = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement)

  await expect(canvas.getByRole('heading', { name: String(args.title) })).toBeInTheDocument()
  await expect(canvas.getAllByRole('button', { name: String(args.primaryCtaLabel) }).length).toBeGreaterThanOrEqual(1)
  await expect(canvas.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument()
  await expect(canvas.getByRole('link', { name: 'Imprint' })).toBeInTheDocument()
  await expect(canvas.getByLabelText('Email')).toBeInTheDocument()
  await expect(canvas.getByText('Why findmydoc')).toBeInTheDocument()
  await expect(canvas.getByText('What you get')).toBeInTheDocument()

  if (args.contactMode === 'compact') {
    await expect(canvas.queryByLabelText('Message')).not.toBeInTheDocument()
  } else {
    await expect(canvas.getByLabelText('Message')).toBeInTheDocument()
  }

  await expect(canvas.getByTestId('immersive-video-hero')).toBeInTheDocument()

  if (!args.heroVideo?.videoSrc) {
    await expect(canvas.getByTestId('hero-video-placeholder')).toBeInTheDocument()
  }
}

export const HoldingPage: Story = {
  args: holdingPageConcept,
  play: assertConceptFrame,
}
