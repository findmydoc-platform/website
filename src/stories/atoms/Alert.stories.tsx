import type { Meta, StoryObj } from '@storybook/react-vite'
import { Alert, AlertDescription, AlertTitle } from '@/components/atoms/alert'

const meta = {
  title: 'Atoms/Alert',
  component: Alert,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'destructive', 'success', 'warning', 'info', 'error'],
    },
  },
} satisfies Meta<typeof Alert>

export default meta
type Story = StoryObj<typeof meta>

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
