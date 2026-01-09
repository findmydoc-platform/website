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
  },
  tags: ['autodocs'],
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

export const CustomCurveAndPlacement: Story = {
  args: {
    curve: {
      // A slightly wider curve and different color for quick iteration in Storybook.
      viewBox: '0 0 160 615',
      pathD: 'M8 8C190 200 210 410 8 607',
      curveClassName: 'text-primary',
      dotClassName: 'fill-primary',
      labelOffsetPx: { x: 56, y: 0 },
      labelEnterShiftPx: 24,
    },
    // Custom dot placements (0..1). These also drive scroll activation thresholds.
    stepProgresses: [0, 0.22, 0.62, 1],
  },
}
