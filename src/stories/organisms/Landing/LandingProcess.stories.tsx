import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { LandingProcess } from '@/components/organisms/Landing'
import { clinicProcessData } from '@/stories/fixtures/listings'

const meta = {
  title: 'Organisms/Landing/LandingProcess',
  component: LandingProcess,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    title: 'Our Process',
    subtitle: 'Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.',
    steps: clinicProcessData,
    imageAlt: 'Process visual',
    stepImages: [
      { src: '/images/process-step-1.svg', alt: 'Process step 1 visual' },
      { src: '/images/process-step-2.svg', alt: 'Process step 2 visual' },
      { src: '/images/process-step-3.svg', alt: 'Process step 3 visual' },
      { src: '/images/process-step-4.svg', alt: 'Process step 4 visual' },
    ],
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
