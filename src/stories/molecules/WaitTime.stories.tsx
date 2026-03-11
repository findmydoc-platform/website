import type { Meta, StoryObj } from '@storybook/react-vite'

import { WaitTime } from '@/components/molecules/WaitTime'
import { sampleClinicWaitTime } from '@/stories/fixtures'

const meta = {
  title: 'Shared/Molecules/WaitTime',
  component: WaitTime,
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
} satisfies Meta<typeof WaitTime>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    value: sampleClinicWaitTime?.label ?? '3–4 weeks',
  },
}
