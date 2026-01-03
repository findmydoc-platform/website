import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { LandingProcess } from '@/components/organisms/Landing'
import { clinicProcessData } from '@/stories/fixtures/listings'
import ph576x968 from '@/stories/assets/placeholder-576-968.png'

const meta = {
  title: 'Organisms/Landing/LandingProcess',
  component: LandingProcess,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    steps: clinicProcessData,
    image: ph576x968,
    imageAlt: 'Smiling clinician in a calm office',
  },
} satisfies Meta<typeof LandingProcess>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
