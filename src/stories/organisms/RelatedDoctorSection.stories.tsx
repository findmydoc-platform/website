import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from '@storybook/test'

import { RelatedDoctorSection, type RelatedDoctorItem } from '@/components/organisms/Doctors'
import { withViewportStory } from '../utils/viewportMatrix'

import clinicConsultation from '../assets/clinic-consultation.jpg'
import clinicInterior from '../assets/content-clinic-interior.jpg'
import examRoom from '../assets/post-hero-exam-room.jpg'

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
      qualifications: ['MD', 'FAAP'],
      experienceYears: 14,
      languages: ['English', 'German', 'French'],
      rating: { value: 4.9, reviewCount: 87 },
      socialLinks: [
        { kind: 'meta', href: '#', label: 'Meta' },
        { kind: 'linkedin', href: '#', label: 'LinkedIn' },
        { kind: 'x', href: '#', label: 'X' },
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
      qualifications: ['MD', 'MSc Pediatric Care'],
      experienceYears: 10,
      languages: ['English', 'Italian'],
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
      qualifications: ['MD'],
      experienceYears: 9,
      languages: ['English', 'Spanish', 'Portuguese'],
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
  title: 'Domain/Doctor/Organisms/RelatedDoctorSection',
  component: RelatedDoctorSection,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs', 'domain:doctor', 'layer:organism', 'status:stable', 'used-in:block:related-doctor-section'],
} satisfies Meta<typeof RelatedDoctorSection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    title: 'Related Doctor',
    doctors,
    initialIndex: 0,
  },
  render: (args) => <RelatedDoctorSection {...args} />,
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

export const Default320: Story = withViewportStory(Default, 'public320', 'Default / 320')
export const Default375: Story = withViewportStory(Default, 'public375', 'Default / 375')
export const Default640: Story = withViewportStory(Default, 'public640', 'Default / 640')
export const Default768: Story = withViewportStory(Default, 'public768', 'Default / 768')
export const Default1024: Story = withViewportStory(Default, 'public1024', 'Default / 1024')
export const Default1280: Story = withViewportStory(Default, 'public1280', 'Default / 1280')
