import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { DoctorCard } from '@/components/organisms/Doctors'

const meta = {
  title: 'Organisms/DoctorCard',
  component: DoctorCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof DoctorCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    data: {
      name: 'Dr. Susan Bones, MD',
      subtitle: 'Board-certified Pediatrician',
      description: 'With experience in managing complex medical conditions in children',
      rating: { value: 4.9, reviewCount: 87 },
      socialLinks: [
        { kind: 'facebook', href: '#', label: 'Facebook' },
        { kind: 'linkedin', href: '#', label: 'LinkedIn' },
        { kind: 'twitter', href: '#', label: 'Twitter' },
      ],
      actions: {
        availability: { href: '#availability', label: 'Availability' },
        call: { href: 'tel:+123456789', label: 'Call' },
        chat: { href: '#chat', label: 'Chat' },
        booking: { href: '#booking', label: 'Booking' },
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('article')).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Dr. Susan Bones, MD' })).toBeInTheDocument()

    await expect(canvas.getByRole('link', { name: 'Facebook' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'LinkedIn' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Twitter' })).toBeInTheDocument()

    await expect(canvas.getByRole('link', { name: 'Availability' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Call' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Chat' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Booking' })).toBeInTheDocument()
  },
}
