import type { Meta, StoryObj } from '@storybook/react-vite'
import { Logo } from '@/components/molecules/Logo/Logo'

const meta = {
  title: 'Molecules/Logo',
  component: Logo,
  tags: ['autodocs'],
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
    <div className="bg-foreground rounded-md p-4">
      <Logo {...args} />
    </div>
  ),
}
