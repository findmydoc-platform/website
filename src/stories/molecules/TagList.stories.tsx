import type { Meta, StoryObj } from '@storybook/react-vite'

import { TagList } from '@/components/molecules/TagList'
import { sampleClinicTags } from '@/stories/fixtures'

const meta = {
  title: 'Shared/Molecules/TagList',
  component: TagList,
  tags: ['autodocs', 'domain:shared', 'layer:molecule', 'status:stable', 'used-in:shared'],
} satisfies Meta<typeof TagList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    tags: sampleClinicTags ?? ['Specialized orthopedics', 'Short wait times', 'On-site physiotherapy'],
  },
}
