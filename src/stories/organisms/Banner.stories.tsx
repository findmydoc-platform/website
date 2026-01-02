import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { expect } from '@storybook/jest'
import { within } from '@storybook/testing-library'
import { Banner } from '@/components/organisms/Banner'

const meta = {
  title: 'Organisms/Banner',
  component: Banner,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Banner>

export default meta

type Story = StoryObj<typeof meta>

export const Info: Story = {
  args: {
    content: <p>findmydoc connects patients with trusted clinics across specialties.</p>,
    style: 'info',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const message = canvas.getByText(
      'findmydoc connects patients with trusted clinics across specialties.',
    )

    await expect(message).toBeInTheDocument()
    await expect(message.closest('div')).toHaveClass(
      'border-primary',
      'bg-primary/15',
      'text-primary',
    )
  },
}

export const Success: Story = {
  args: {
    content: <p>Your appointment has been successfully booked!</p>,
    style: 'success',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const message = canvas.getByText('Your appointment has been successfully booked!')

    await expect(message).toBeInTheDocument()
    await expect(message.closest('div')).toHaveClass(
      'border-success',
      'bg-success/30',
      'text-success',
    )
  },
}

export const Warning: Story = {
  args: {
    content: <p>Please review your information before submitting.</p>,
    style: 'warning',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const message = canvas.getByText('Please review your information before submitting.')

    await expect(message).toBeInTheDocument()
    await expect(message.closest('div')).toHaveClass(
      'border-warning',
      'bg-warning/30',
      'text-warning',
    )
  },
}

export const Error: Story = {
  args: {
    content: <p>An error occurred while processing your request.</p>,
    style: 'error',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const message = canvas.getByText('An error occurred while processing your request.')

    await expect(message).toBeInTheDocument()
    await expect(message.closest('div')).toHaveClass(
      'border-error',
      'bg-error/30',
      'text-error',
    )
  },
}
