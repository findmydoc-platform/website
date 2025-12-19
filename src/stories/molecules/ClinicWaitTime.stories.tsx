import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ClinicWaitTime } from '@/components/molecules/ClinicWaitTime'
import { sampleClinicWaitTime } from '@/stories/fixtures'

const meta = {
  title: 'Molecules/ClinicWaitTime',
  component: ClinicWaitTime,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ClinicWaitTime>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: sampleClinicWaitTime ?? '3–4 weeks',
  },
}
