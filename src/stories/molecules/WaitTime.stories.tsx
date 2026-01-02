import type { Meta, StoryObj } from '@storybook/react-vite'

import { WaitTime } from '@/components/molecules/WaitTime'
import { sampleClinicWaitTime } from '@/stories/fixtures'

const meta = {
  title: 'Molecules/WaitTime',
  component: WaitTime,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof WaitTime>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: sampleClinicWaitTime ?? '3–4 weeks',
  },
}
