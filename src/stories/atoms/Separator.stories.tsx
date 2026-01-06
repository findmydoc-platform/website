import type { Meta, StoryObj } from '@storybook/react-vite'
import { Separator } from '@/components/atoms/separator'

const meta = {
  title: 'Atoms/Separator',
  component: Separator,
  tags: ['autodocs'],
  argTypes: {
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
    },
  },
} satisfies Meta<typeof Separator>

export default meta
type Story = StoryObj<typeof meta>

export const Horizontal: Story = {
  render: () => (
    <div>
      <p className="text-sm">Upcoming appointment</p>
      <Separator className="my-4" />
      <p className="text-sm">Previous appointment</p>
    </div>
  ),
}

export const Vertical: Story = {
  render: () => (
    <div className="flex h-32 items-center">
      <span>Clinics</span>
      <Separator orientation="vertical" className="mx-4" />
      <span>Doctors</span>
    </div>
  ),
}
