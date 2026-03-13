import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { HoldingPageConcept } from '@/components/templates/HoldingPageConcept'
import { conceptOrder, holdingPageConcepts } from '@/stories/fixtures/holdingPageConcepts'

const meta = {
  title: 'Templates/HoldingPageConcept',
  component: HoldingPageConcept,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Storybook-only launch page concept to compare holding-page directions before production implementation.',
      },
    },
  },
  tags: ['autodocs'],
  args: holdingPageConcepts.trustedArrival,
} satisfies Meta<typeof HoldingPageConcept>

export default meta

type Story = StoryObj<typeof meta>
type ConceptKey = (typeof conceptOrder)[number]

const assertConceptFrame: Story['play'] = async ({ args, canvasElement }) => {
  const canvas = within(canvasElement)

  await expect(canvas.getByRole('heading', { name: String(args.title) })).toBeInTheDocument()
  await expect(canvas.getAllByRole('button', { name: String(args.primaryCtaLabel) }).length).toBeGreaterThanOrEqual(1)
  await expect(canvas.getByRole('link', { name: 'Privacy Policy' })).toBeInTheDocument()
  await expect(canvas.getByRole('link', { name: 'Imprint' })).toBeInTheDocument()
  await expect(canvas.getByLabelText('Email')).toBeInTheDocument()

  if (args.visualVariant === 'videoImmersiveHero') {
    await expect(canvas.getByText('Why findmydoc')).toBeInTheDocument()
    await expect(canvas.getByText('What you get')).toBeInTheDocument()
  } else {
    await expect(canvas.getByText('Search fit')).toBeInTheDocument()
    await expect(canvas.getByText(`Keyword: ${String(args.searchSnapshot.primaryKeyword)}`)).toBeInTheDocument()
  }

  if (args.contactMode === 'compact') {
    await expect(canvas.queryByLabelText('Message')).not.toBeInTheDocument()
  } else {
    await expect(canvas.getByLabelText('Message')).toBeInTheDocument()
  }

  if (args.visualVariant === 'videoImmersiveHero') {
    await expect(canvas.getByTestId('immersive-video-hero')).toBeInTheDocument()

    if (!args.heroVideo?.videoSrc) {
      await expect(canvas.getByTestId('hero-video-placeholder')).toBeInTheDocument()
    }
  }
}

const buildStory = (key: ConceptKey): Story => ({
  args: holdingPageConcepts[key],
  play: assertConceptFrame,
})

export const TrustedArrival: Story = buildStory('trustedArrival')

export const CompareBeforeTravel: Story = buildStory('compareBeforeTravel')

export const DentalConfidence: Story = buildStory('dentalConfidence')

export const VisionPrecision: Story = buildStory('visionPrecision')

export const HairRestorationJourney: Story = buildStory('hairRestorationJourney')

export const SkinScienceTrust: Story = buildStory('skinScienceTrust')

export const SurgicalClarity: Story = buildStory('surgicalClarity')

export const MedicalTravelRoute: Story = buildStory('medicalTravelRoute')

export const StandardsYouCanFeel: Story = buildStory('standardsYouCanFeel')

export const OnePlatformManyPaths: Story = buildStory('onePlatformManyPaths')

export const VideoConsultationCanvas: Story = buildStory('videoConsultationCanvas')

export const VideoProcedureLight: Story = buildStory('videoProcedureLight')

export const VideoArrivalWindow: Story = buildStory('videoArrivalWindow')

export const VideoImmersiveHero: Story = buildStory('videoImmersiveHero')
