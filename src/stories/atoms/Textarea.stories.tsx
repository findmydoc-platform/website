import type { Meta, StoryObj } from '@storybook/react-vite'
import { Textarea } from '@/components/atoms/textarea'

const meta = {
  title: 'Atoms/Textarea',
  component: Textarea,
  tags: ['autodocs'],
} satisfies Meta<typeof Textarea>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  args: {
    placeholder: 'Describe the treatment experience...',
    rows: 4,
  },
}

export const WithDefaultValue: Story = {
  args: {
    defaultValue: 'Clinic staff was responsive and the facilities were spotless.',
    rows: 4,
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Textarea is disabled',
    disabled: true,
  },
}
