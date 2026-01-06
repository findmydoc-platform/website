import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'

const meta = {
  title: 'Atoms/Input',
  component: Input,
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

export const WithError: Story = {
  render: (args) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor="email">Email</Label>
      <Input id="email" aria-invalid aria-describedby="email-error" {...args} />
      <p id="email-error" className="text-destructive text-sm">
        Please enter a valid email address.
      </p>
    </div>
  ),
  args: {
    type: 'email',
    placeholder: 'name@findmydoc.com',
  },
}
