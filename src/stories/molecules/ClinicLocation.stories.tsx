import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ClinicLocation } from '@/components/molecules/ClinicLocation'

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
    value: 'Munich Schwabing',
  },
}
