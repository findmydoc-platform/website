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
    title: 'Vertrauen Sie auf geprüfte Qualität',
    subtitle: 'Wir arbeiten nur mit zertifizierten Kliniken und garantieren transparente, aktuelle\nPreisinformationen',
    stats: [
      { value: '500+', label: 'Verifizierte Kliniken', Icon: Users },
      { value: '1.200+', label: 'Behandlungsarten', Icon: BadgeCheck },
      { value: '98%', label: 'Zufriedenheitsrate', Icon: Award },
      { value: 'TÜV', label: 'Geprüfte Plattform', Icon: Shield },
    ],
    badges: ['TÜV Süd zertifiziert', 'DSGVO-konform', 'Geprüfte Klinikdaten', 'Datenschutz garantiert'],
  },
} satisfies Meta<typeof TrustQualitySection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
