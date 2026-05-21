import type React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Alert, AlertDescription, AlertTitle } from '@/components/atoms/alert'

const meta = {
  title: 'Shared/Atoms/Alert',
  component: Alert,
  tags: ['autodocs', 'domain:shared', 'layer:atom', 'status:stable', 'used-in:shared'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'success', 'warning', 'info', 'error'],
    },
  },
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

const variants = [
  {
    label: 'Default',
    variant: 'default',
    description: 'A neutral message for general context.',
  },
  {
    label: 'Success',
    variant: 'success',
    description: 'A completed action or positive state.',
  },
  {
    label: 'Information',
    variant: 'info',
    description: 'Useful context for the next step.',
  },
  {
    label: 'Warning',
    variant: 'warning',
    description: 'A recoverable condition that needs attention.',
  },
  {
    label: 'Error',
    variant: 'error',
    description: 'A failed action or validation problem.',
  },
  {
    label: 'Destructive',
    variant: 'destructive',
    description: 'A destructive or irreversible action warning.',
  },
] satisfies Array<{
  label: string
  variant: NonNullable<React.ComponentProps<typeof Alert>['variant']>
  description: string
}>

export const Default: Story = {
  args: {
    variant: 'default',
    children: (
      <div>
        <AlertTitle>Heads up!</AlertTitle>
        <AlertDescription>This is a generic alert message.</AlertDescription>
      </div>
    ),
  },
}

export const Success: Story = {
  args: {
    variant: 'success',
    children: (
      <div>
        <AlertTitle>Success</AlertTitle>
        <AlertDescription>Your action completed without any issues.</AlertDescription>
      </div>
    ),
  },
}

export const Info: Story = {
  args: {
    variant: 'info',
    children: (
      <div>
        <AlertTitle>Information</AlertTitle>
        <AlertDescription>This is useful context for the next step.</AlertDescription>
      </div>
    ),
  },
}

export const Warning: Story = {
  args: {
    variant: 'warning',
    children: (
      <div>
        <AlertTitle>Warning</AlertTitle>
        <AlertDescription>Please double-check the information you entered.</AlertDescription>
      </div>
    ),
  },
}

export const Error: Story = {
  args: {
    variant: 'error',
    children: (
      <div>
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something needs attention before you continue.</AlertDescription>
      </div>
    ),
  },
}

export const Destructive: Story = {
  args: {
    variant: 'destructive',
    children: (
      <div>
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Something went wrong. Please try again.</AlertDescription>
      </div>
    ),
  },
}

export const AllVariants: Story = {
  render: () => (
    <div className="mx-auto grid w-full max-w-2xl gap-4 p-6">
      {variants.map((item) => (
        <Alert key={item.variant} variant={item.variant}>
          <AlertTitle>{item.label}</AlertTitle>
          <AlertDescription>{item.description}</AlertDescription>
        </Alert>
      ))}
    </div>
  ),
}
