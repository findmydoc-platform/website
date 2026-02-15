import type { Meta, StoryObj } from '@storybook/react-vite'

import { LandingProcess } from '@/components/organisms/Landing'
import { clinicProcessData } from '@/stories/fixtures/listings'
import {
  landingProcessPlaceholderStepImages,
  landingProcessPlaceholderSubtitle,
  landingProcessPlaceholderTitle,
} from '@/utilities/placeholders/landingProcess'

const meta = {
  title: 'Organisms/Landing/LandingProcess',
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
  tags: ['autodocs'],
  argTypes: {
    stepPercentages: {
      description:
        'Per-step percentages (0..100). Use one value per step. Controls both dot position on the curve and activation timing.',
      control: 'object',
    },
    stepActivationOffsetPx: {
      description:
        'Activation timing offset in path-px along the curve (not viewport px). Positive = earlier, negative = later. Accepts a single number or an array per step.',
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

export const Default: Story = {}

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
