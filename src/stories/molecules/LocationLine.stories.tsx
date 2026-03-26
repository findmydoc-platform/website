import type { Meta, StoryObj } from '@storybook/react-vite'

import { LocationLine } from '@/components/molecules/LocationLine'
import { sampleClinicLocation } from '@/stories/fixtures'

const meta = {
  title: 'Shared/Molecules/LocationLine',
  component: LocationLine,
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
} satisfies Meta<typeof LocationLine>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: sampleClinicLocation ?? 'Munich, Schwabing',
  },
}

export const WithGoogleMapsLink: Story = {
  args: {
    value: sampleClinicLocation ?? 'Munich, Schwabing',
    href: 'https://www.google.com/maps?q=48.1351,11.5820',
  },
}
