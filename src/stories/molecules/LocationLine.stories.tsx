import type { Meta, StoryObj } from '@storybook/react-vite'

import { LocationLine } from '@/components/molecules/LocationLine'
import { sampleClinicLocation } from '@/stories/fixtures'

const meta = {
  title: 'Molecules/LocationLine',
  component: LocationLine,
  tags: ['autodocs'],
} satisfies Meta<typeof LocationLine>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: sampleClinicLocation ?? 'Munich, Schwabing',
  },
}
