import type { Meta, StoryObj } from '@storybook/react-vite'
import { Logo } from '@/components/molecules/Logo/Logo'

const meta = {
  title: 'Molecules/Logo',
  component: Logo,
  tags: ['autodocs'],
  description: 'Brand logo component with dark and white variants for different background contexts.',
  argTypes: {
    variant: {
      control: 'select',
      options: ['dark', 'white'],
    },
  },
} satisfies Meta<typeof Logo>

export default meta
type Story = StoryObj<typeof meta>

export const Dark: Story = {
  args: {
    variant: 'dark',
  },
}

export const White: Story = {
  args: {
    variant: 'white',
  },
  render: (args) => (
    <div className="rounded-md bg-foreground p-4">
      <Logo {...args} />
    </div>
  ),
}
