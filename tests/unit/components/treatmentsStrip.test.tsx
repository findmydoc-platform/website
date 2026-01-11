// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { TreatmentsStrip, type TreatmentsStripItem } from '@/components/organisms/TreatmentsStrip'

const items: TreatmentsStripItem[] = [
  {
    title: 'Vaccinations',
    description:
      'The Pediatric Department provides vaccinations to help protect children from a range of illnesses and diseases.',
  },
  {
    title: 'Management of acute illnesses',
    description:
      'The Pediatric Department provides treatment for common childhood illnesses, such as ear infections, strep throat, and viral infections.',
  },
  {
    title: 'Treatment of chronic conditions',
    description:
      'The Pediatric Department provides ongoing care and treatment for children with chronic conditions such as asthma, diabetes, and allergies.',
  },
  {
    title: 'Developmental screenings',
    description:
      'The Pediatric Department provides regular developmental screenings to identify any delays or concerns and provide early intervention services as needed.',
  },
]

describe('TreatmentsStrip', () => {
  it('renders heading and all tiles', () => {
    render(<TreatmentsStrip heading="Treatments" items={items} activeIndex={2} />)

    expect(screen.getByRole('heading', { name: 'Treatments' })).toBeInTheDocument()

    items.forEach(({ title, description }) => {
      expect(screen.getAllByText(title).length).toBeGreaterThan(0)
      expect(screen.getAllByText(description).length).toBeGreaterThan(0)
    })
  })

  it('calls onActiveIndexChange when a tile is clicked', () => {
    const onActiveIndexChange = vi.fn()

    render(
      <TreatmentsStrip heading="Treatments" items={items} activeIndex={2} onActiveIndexChange={onActiveIndexChange} />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Vaccinations' }))
    expect(onActiveIndexChange).toHaveBeenCalledWith(0)
  })

  it('applies line clamping classes to descriptions', () => {
    render(<TreatmentsStrip heading="Treatments" items={items} activeIndex={2} />)

    const firstDescription = items[0].description
    const matches = screen.getAllByText(firstDescription)
    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]).toHaveClass('line-clamp-4')
  })
})
