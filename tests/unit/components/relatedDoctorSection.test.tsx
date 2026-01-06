// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/image', () => ({
  default: (props: unknown) => {
    const {
      blurDataURL: _blurDataURL,
      fill: _fill,
      loader: _loader,
      placeholder: _placeholder,
      priority: _priority,
      quality: _quality,
      sizes: _sizes,
      ...rest
    } = props as Record<string, unknown>

    return React.createElement('img', rest)
  },
}))

import { RelatedDoctorSection, type RelatedDoctorItem } from '@/components/organisms/Doctors'

describe('RelatedDoctorSection', () => {
  it('navigates between doctors via arrows and dots', async () => {
    const doctors: RelatedDoctorItem[] = [
      {
        id: 'a',
        heroMedia: { src: '/a.jpg', alt: 'A' },
        card: {
          name: 'Dr. A',
          actions: { booking: { href: '#a', label: 'Booking' } },
        },
      },
      {
        id: 'b',
        heroMedia: { src: '/b.jpg', alt: 'B' },
        card: {
          name: 'Dr. B',
          actions: { booking: { href: '#b', label: 'Booking' } },
        },
      },
      {
        id: 'c',
        heroMedia: { src: '/c.jpg', alt: 'C' },
        card: {
          name: 'Dr. C',
          actions: { booking: { href: '#c', label: 'Booking' } },
        },
      },
    ]

    render(<RelatedDoctorSection title="Related Doctor" doctors={doctors} initialIndex={0} />)

    expect(screen.getByRole('heading', { name: 'Related Doctor' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dr. A' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Next doctor' }))
    expect(screen.getByRole('heading', { name: 'Dr. B' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Show doctor 3:/ }))
    expect(screen.getByRole('heading', { name: 'Dr. C' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Previous doctor' }))
    expect(screen.getByRole('heading', { name: 'Dr. B' })).toBeInTheDocument()
  })
})
