import type { Meta, StoryObj } from '@storybook/nextjs-vite'

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
    scrollOffset: 0.6,
    triggerClassName: 'h-[40vh]',
    tailClassName: 'h-[90vh]',
    stepMotion: {
      enterDuration: 0.8,
      exitDuration: 0.5,
      xOffset: 50,
    },
    imageFadeDuration: 0.35,
  },
} satisfies Meta<typeof LandingProcess>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
