import type { Meta, StoryObj } from '@storybook/react-vite'

import { LandingTeam } from '@/components/organisms/Landing'
import { clinicTeamData } from '@/stories/fixtures/listings'

const getTeamMemberByName = (name: string) => {
  const member = clinicTeamData.find((teamMember) => teamMember.name === name)

  if (!member) {
    throw new Error(`Missing team member fixture for: ${name}`)
  }

  return member
}

const volkanMember = getTeamMemberByName('Volkan Kablan')
const anilMember = getTeamMemberByName('Anil Gökduman')
const youssefMember = getTeamMemberByName('Youssef Adlah')

const meta = {
  title: 'Domain/Landing/Organisms/Landing/LandingTeam',
  component: LandingTeam,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:landing', 'layer:organism', 'status:stable', 'used-in:block:landing-team'],
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

export const MixedPhotoDisplayModes: Story = {
  args: {
    team: [
      { ...volkanMember, isPhoto: true, photoDisplay: 'original' },
      { ...anilMember, isPhoto: true, photoDisplay: 'grayscale' },
      { ...youssefMember, isPhoto: false },
    ],
    title: 'Photo Display Modes',
    description: 'Shows original and grayscale photo rendering, while placeholder images remain unchanged.',
  },
}
