import type { Meta, StoryObj } from '@storybook/react-vite'
import React from 'react'
import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'

const meta = {
  title: 'Shared/Atoms/Input',
  component: Input,
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable', 'used-in:shared'],
  parameters: {
    docs: {
      description: {
        component:
          'Text input field for user data entry. Supports various types (text, email, password) and validation states.',
      },
    },
  },
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
    <Field data-invalid>
      <Label htmlFor="email">Email</Label>
      <Input id="email" aria-invalid aria-describedby="email-error" {...args} />
      <FieldError id="email-error">Please enter a valid email address.</FieldError>
    </Field>
  ),
  args: {
    type: 'email',
    placeholder: 'name@findmydoc.com',
  },
}
