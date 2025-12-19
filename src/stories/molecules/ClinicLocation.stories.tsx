import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ClinicLocation } from '@/components/molecules/ClinicLocation'
import { sampleClinicLocation } from '@/stories/fixtures'

const meta = {
  title: 'Molecules/ClinicLocation',
  component: ClinicLocation,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ClinicLocation>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: sampleClinicLocation ?? 'Munich, Schwabing',
  },
}
