import type { Meta, StoryObj } from '@storybook/react-vite'

import { LandingTeam } from '@/components/organisms/Landing'
import { clinicTeamData } from '@/stories/fixtures/listings'

const meta = {
  title: 'Organisms/Landing/LandingTeam',
  component: LandingTeam,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    team: clinicTeamData,
    title: 'Our Team',
    description:
      'We are a multidisciplinary team with backgrounds in healthcare, international patient management, medical marketing, and platform technology.',
  },
} satisfies Meta<typeof LandingTeam>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
