import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect } from '@storybook/jest'
import { userEvent, within } from '@storybook/testing-library'

import { RelatedDoctorSection, type RelatedDoctorItem } from '@/components/organisms/Doctors'

import clinicConsultation from '@/stories/assets/clinic-consultation.jpg'
import clinicInterior from '@/stories/assets/content-clinic-interior.jpg'
import examRoom from '@/stories/assets/post-hero-exam-room.jpg'

const getSrc = (img: string | { src: string }) => (typeof img === 'string' ? img : img.src)

const doctors: RelatedDoctorItem[] = [
  {
    id: 'susan-bones',
    heroMedia: {
      src: getSrc(clinicConsultation),
      alt: 'Doctor consulting with a patient',
    },
    card: {
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
  {
    id: 'david-angelo',
    heroMedia: {
      src: getSrc(examRoom),
      alt: 'Bright exam room',
    },
    card: {
      name: 'Dr. David Angelo, MD',
      subtitle: 'Pediatric Specialist',
      description: 'Focused on preventative care, childhood wellness, and family education',
      rating: { value: 4.7, reviewCount: 142 },
      socialLinks: [{ kind: 'linkedin', href: '#', label: 'LinkedIn' }],
      actions: {
        availability: { href: '#availability', label: 'Availability' },
        call: { href: 'tel:+123456789', label: 'Call' },
        chat: { href: '#chat', label: 'Chat' },
        booking: { href: '#booking', label: 'Booking' },
      },
    },
  },
  {
    id: 'emily-wells',
    heroMedia: {
      src: getSrc(clinicInterior),
      alt: 'Bright clinic interior',
    },
    card: {
      name: 'Dr. Emily Wells, MD',
      subtitle: 'Pediatrician',
      description: 'Experienced in managing chronic conditions and coordinating multi-disciplinary care',
      rating: { value: 4.8, reviewCount: 211 },
      actions: {
        availability: { href: '#availability', label: 'Availability' },
        call: { href: 'tel:+123456789', label: 'Call' },
        chat: { href: '#chat', label: 'Chat' },
        booking: { href: '#booking', label: 'Booking' },
      },
    },
  },
]

const meta = {
  title: 'Organisms/RelatedDoctorSection',
  component: RelatedDoctorSection,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof RelatedDoctorSection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Related Doctor',
    doctors,
    initialIndex: 0,
  },
  render: (args) => (
    <div className="mx-auto w-[min(1100px,calc(100vw-2rem))]">
      <RelatedDoctorSection {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { name: 'Related Doctor' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'Dr. Susan Bones, MD' })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Next doctor' }))
    await expect(canvas.getByRole('heading', { name: 'Dr. David Angelo, MD' })).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: /Show doctor 3:/ }))
    await expect(canvas.getByRole('heading', { name: 'Dr. Emily Wells, MD' })).toBeInTheDocument()
  },
}
