// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ListingComparisonFilters } from '@/app/(frontend)/listing-comparison/ListingComparisonFilters.client'

const specialtyOptions = [
  { value: 'surgery', label: 'Surgery', depth: 0, parentValue: null },
  { value: 'facial', label: 'Facial Surgery', depth: 1, parentValue: 'surgery' },
  { value: 'dental', label: 'Dental', depth: 0, parentValue: null },
]

const treatmentGroups = [
  {
    specialty: specialtyOptions[1]!,
    options: [
      { value: 'rhinoplasty', label: 'Rhinoplasty' },
      { value: 'blepharoplasty', label: 'Blepharoplasty' },
    ],
  },
  {
    specialty: specialtyOptions[2]!,
    options: [{ value: 'dental-implant', label: 'Dental implant' }],
  },
]

describe('ListingComparisonFilters', () => {
  beforeAll(() => {
    class ResizeObserverMock {
      observe() {
        return undefined
      }
      unobserve() {
        return undefined
      }
      disconnect() {
        return undefined
      }
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  })

  afterAll(() => {
    vi.unstubAllGlobals()
  })

  it('renders all treatment groups by default when no specialty is selected', () => {
    render(
      <ListingComparisonFilters
        specialtyOptions={specialtyOptions}
        treatmentGroups={treatmentGroups}
        initialValues={{
          cities: [],
          specialty: null,
          waitTimes: [],
          treatments: [],
          priceRange: [0, 20000],
          rating: null,
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Treatment/i }))

    expect(screen.getAllByText('Facial Surgery').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Dental').length).toBeGreaterThan(0)
    expect(screen.getByRole('checkbox', { name: 'Rhinoplasty' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Dental implant' })).toBeInTheDocument()
  })

  it('automatically selects the matching specialty when a treatment is selected without active specialty', async () => {
    const onChange = vi.fn()

    render(
      <ListingComparisonFilters
        specialtyOptions={specialtyOptions}
        treatmentGroups={treatmentGroups}
        initialValues={{
          cities: [],
          specialty: null,
          waitTimes: [],
          treatments: [],
          priceRange: [0, 20000],
          rating: null,
        }}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Treatment/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Rhinoplasty' }))

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0]
      expect(lastCall?.specialty).toBe('facial')
      expect(lastCall?.treatments).toEqual(['rhinoplasty'])
    })
  })

  it('switches scope and consolidates treatment selection after changing specialty', async () => {
    const onChange = vi.fn()

    render(
      <ListingComparisonFilters
        specialtyOptions={specialtyOptions}
        treatmentGroups={treatmentGroups}
        initialValues={{
          cities: [],
          specialty: 'facial',
          waitTimes: [],
          treatments: ['rhinoplasty'],
          priceRange: [0, 20000],
          rating: null,
        }}
        onChange={onChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Treatment/i }))
    expect(screen.queryByRole('checkbox', { name: 'Dental implant' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Medical Specialty/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Dental' }))

    fireEvent.click(screen.getByRole('checkbox', { name: 'Dental implant' }))

    await waitFor(() => {
      const lastCall = onChange.mock.calls.at(-1)?.[0]
      expect(lastCall?.specialty).toBe('dental')
      expect(lastCall?.treatments).toEqual(['dental-implant'])
    })
  })
})
