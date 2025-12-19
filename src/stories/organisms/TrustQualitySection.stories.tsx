import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { Award, BadgeCheck, Shield, Users } from 'lucide-react'

import { TrustQualitySection } from '@/components/organisms/TrustQualitySection'

const meta = {
  title: 'Organisms/TrustQualitySection',
  component: TrustQualitySection,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    title: 'Trust in Proven Quality',
    subtitle: 'We only work with certified clinics and guarantee transparent, up-to-date\npricing information',
    stats: [
      { value: '500+', label: 'Verified Clinics', Icon: Users },
      { value: '1,200+', label: 'Treatment Types', Icon: BadgeCheck },
      { value: '98%', label: 'Satisfaction Rate', Icon: Award },
      { value: 'TÜV', label: 'Verified Platform', Icon: Shield },
    ],
    badges: ['TÜV Süd certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed'],
  },
} satisfies Meta<typeof TrustQualitySection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
