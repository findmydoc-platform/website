import type { Meta, StoryObj } from '@storybook/nextjs-vite'
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
}

export const Success: Story = {
  args: {
    content: <p>Your appointment has been successfully booked!</p>,
    style: 'success',
  },
}

export const Warning: Story = {
  args: {
    content: <p>Please review your information before submitting.</p>,
    style: 'warning',
  },
}

export const Error: Story = {
  args: {
    content: <p>An error occurred while processing your request.</p>,
    style: 'error',
  },
}
