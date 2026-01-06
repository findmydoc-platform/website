// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { DoctorCard } from '@/components/organisms/Doctors'

describe('DoctorCard', () => {
  it('renders name, rating, social links, and actions', () => {
    render(
      <DoctorCard
        data={{
          name: 'Dr. Susan Bones, MD',
          subtitle: 'Board-certified Pediatrician',
          description: 'With experience in managing complex medical conditions in children',
          rating: { value: 4.9, reviewCount: 87 },
          socialLinks: [
            { kind: 'facebook', href: '#', label: 'Facebook' },
            { kind: 'linkedin', href: '#', label: 'LinkedIn' },
          ],
          actions: {
            availability: { href: '#availability', label: 'Availability' },
            call: { href: 'tel:+123', label: 'Call' },
            chat: { href: '#chat', label: 'Chat' },
            booking: { href: '#booking', label: 'Booking' },
          },
        }}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Dr. Susan Bones, MD' })).toBeInTheDocument()
    expect(screen.getByText('4.9/5')).toBeInTheDocument()
    expect(screen.getByText('87 Reviews')).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Facebook' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'LinkedIn' })).toBeInTheDocument()

    expect(screen.getByRole('link', { name: 'Availability' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Call' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Booking' })).toBeInTheDocument()
  })
})
