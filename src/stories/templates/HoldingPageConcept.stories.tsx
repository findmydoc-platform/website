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
        component: [
          'This story documents the Findmydoc production holding landing page concept.',
          '',
          'Purpose:',
          '- Provide a premium, brand-consistent placeholder homepage while the platform is not fully public yet.',
          '- Reduce go-live risk by validating messaging, trust cues, legal links, and contact capture before switching the real homepage on.',
          '',
          'How it is intended to be used in production:',
          '- A feature flag/environment toggle enables the holding page for production traffic until launch.',
          '- When the toggle is turned off, the full site becomes the default experience.',
          '',
          'What the holding page must communicate:',
          '- Comparison-first positioning: visitors should immediately understand that Findmydoc helps compare clinics abroad.',
          '- Trust signals: emphasize verified quality information (ratings, reviews, verification, accreditations) without overclaiming.',
          '- A clear next step: capture intent with a compact contact/updates form.',
          '- Legal clarity: always keep Privacy Policy and Imprint visible.',
          '',
          'Hero video template notes:',
          '- The hero is intentionally dominant (near fullscreen) to create a calm, premium first impression.',
          '- If a `heroVideo.videoSrc` is missing, the UI shows a visible placeholder to prevent silent regressions.',
          '- The final video asset can be swapped without changing layout or copy.',
          '',
          'Context:',
          '- This direction was designed as a light (white) page system, not a dark landing page.',
          '- Copy is written to be production-ready and aligned with the existing SEO style for Findmydoc (comparison, trust, cross-border care).',
        ].join('\n'),
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
