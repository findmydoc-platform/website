import type { Meta, StoryObj } from '@storybook/nextjs-vite'

import { ClinicTags } from '@/components/molecules/ClinicTags'
import { sampleClinicTags } from '@/stories/fixtures'

const meta = {
  title: 'Molecules/ClinicTags',
  component: ClinicTags,
  parameters: {
    layout: 'centered',
  },
} satisfies Meta<typeof ClinicTags>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    tags: sampleClinicTags ?? ['Specialized orthopedics', 'Short wait times', 'On-site physiotherapy'],
  },
}
