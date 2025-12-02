import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ClinicFilters } from '@/components/organisms/ClinicFilters'

const meta: Meta<typeof ClinicFilters> = {
  title: 'Organisms/ClinicFilters',
  component: ClinicFilters,
}

export default meta

type Story = StoryObj<typeof ClinicFilters>

export const Default: Story = {
  args: {},
}
