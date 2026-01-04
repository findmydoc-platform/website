import type { Meta, StoryObj } from '@storybook/react-vite'

import { TagList } from '@/components/molecules/TagList'
import { sampleClinicTags } from '@/stories/fixtures'

const meta = {
  title: 'Molecules/TagList',
  component: TagList,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof TagList>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    tags: sampleClinicTags ?? ['Specialized orthopedics', 'Short wait times', 'On-site physiotherapy'],
  },
}
