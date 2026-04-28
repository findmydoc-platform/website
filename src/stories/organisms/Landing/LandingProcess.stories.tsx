import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { LandingProcess } from '@/components/organisms/Landing'
import { clinicProcessData } from '@/stories/fixtures/listings'
import { withViewportStory } from '../../utils/viewportMatrix'
import {
  landingProcessPlaceholderStepImages,
  landingProcessPlaceholderSubtitle,
  landingProcessPlaceholderTitle,
} from '@/utilities/placeholders/landingProcess'

const meta = {
  title: 'Domain/Landing/Organisms/LandingProcess',
  component: LandingProcess,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Control point position and activation timing with `stepPercentages` (0..100). Example: `[0, 25, 50, 100]` makes step 3 appear exactly at 50% line progress and at the 50% curve position.',
      },
    },
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:stable', 'used-in:block:landing-process'],
  argTypes: {
    stepPercentages: {
      description:
        'Per-step percentages (0..100). Use one value per step. Controls both dot position on the curve and activation timing.',
      control: 'object',
    },
    stepActivationOffsetPx: {
      description:
        'Activation timing offset in SVG path length units (viewBox user units from `path.getTotalLength()`, not CSS/viewport px). Positive = earlier, negative = later. Accepts a single number or an array per step.',
      control: 'object',
    },
    labelPercentages: {
      description:
        'Optional per-step percentages (0..100) for text labels only. If omitted, labels follow default label placement.',
      control: 'object',
    },
    stepProgresses: {
      description: 'Legacy (0..1). Prefer `stepPercentages`.',
      control: 'object',
    },
    labelProgresses: {
      description: 'Legacy (0..1). Prefer `labelPercentages`.',
      control: 'object',
    },
  },
  args: {
    title: landingProcessPlaceholderTitle,
    subtitle: landingProcessPlaceholderSubtitle,
    steps: clinicProcessData,
    imageAlt: 'Process visual',
    stepImages: landingProcessPlaceholderStepImages,
    imageFadeDuration: 0.35,
  },
} satisfies Meta<typeof LandingProcess>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: landingProcessPlaceholderTitle })).toBeInTheDocument()
    await expect(canvas.getAllByText('Reach Out').length).toBeGreaterThan(0)
    await expect(canvas.getAllByText('Finalize Profile').length).toBeGreaterThan(0)
    await expect(canvas.getAllByText('Verification & Quality Check').length).toBeGreaterThan(0)
    await expect(canvas.getAllByText('Connect with Patients').length).toBeGreaterThan(0)
  },
}

export const PercentControlledSteps: Story = {
  args: {
    stepPercentages: [0, 30, 60, 100],
  },
}

export const ActivationOffset: Story = {
  args: {
    stepPercentages: [0, 33.33, 66.67, 100],
    stepActivationOffsetPx: [0, 28, 48, 0],
  },
}

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')
