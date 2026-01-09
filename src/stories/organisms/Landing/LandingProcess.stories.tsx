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
