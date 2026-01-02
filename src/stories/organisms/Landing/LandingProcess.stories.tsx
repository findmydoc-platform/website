import type { Meta, StoryObj } from '@storybook/react-vite'

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
    steps: clinicProcessData,
  },
} satisfies Meta<typeof LandingProcess>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
