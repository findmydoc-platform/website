import type { Meta, StoryObj } from '@storybook/react'
import { Input } from '@/components/atoms/input'

const meta = {
  title: 'Atoms/Input',
  component: Input,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'search'],
    },
    disabled: {
      control: 'boolean',
    },
  },
} satisfies Meta<typeof Input>

export default meta
type Story = StoryObj<typeof meta>

export const Text: Story = {
  args: {
    placeholder: 'Search for clinics',
    type: 'text',
  },
}

export const Email: Story = {
  args: {
    placeholder: 'name@findmydoc.com',
    type: 'email',
  },
}

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
}
