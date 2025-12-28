import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { LocationLine } from '@/components/molecules/LocationLine'
import { sampleClinicLocation } from '@/stories/fixtures'

const meta = {
  title: 'Molecules/LocationLine',
  component: LocationLine,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof LocationLine>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: sampleClinicLocation ?? 'Munich, Schwabing',
  },
}
