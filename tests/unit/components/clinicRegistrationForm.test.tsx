// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type React from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ClinicRegistrationForm } from '@/components/organisms/Auth/ClinicRegistrationForm'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const cityOptions = [
  { id: '10', name: 'Istanbul' },
  { id: '11', name: 'Ankara' },
]

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
  window.HTMLElement.prototype.scrollIntoView = vi.fn()
})

afterAll(() => {
  vi.unstubAllGlobals()
})

const fillRequiredFields = ({ includeWebsite = true }: { includeWebsite?: boolean } = {}) => {
  fireEvent.change(screen.getByLabelText('Clinic Name'), { target: { value: 'Aurora Clinic' } })
  if (includeWebsite) {
    fireEvent.change(screen.getByLabelText('Website or public profile'), { target: { value: 'aurora-clinic.example' } })
  }
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Lovelace' } })
  fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Test Street' } })
  fireEvent.change(screen.getByLabelText('House Number'), { target: { value: '12A' } })
  fireEvent.change(screen.getByLabelText('Postal Code'), { target: { value: '34000' } })
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'clinic@example.com' } })
}

describe('ClinicRegistrationForm', () => {
  it('shows Turkey as a fixed country and submits a selected city', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ClinicRegistrationForm cityOptions={cityOptions} onSubmit={onSubmit} />)

    expect(screen.getByText('Turkey')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Country' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Additional Notes')).not.toBeInTheDocument()

    fillRequiredFields()
    fireEvent.click(screen.getByRole('combobox', { name: 'City' }))
    expect(within(document.body).getByRole('combobox', { name: 'Search cities' })).toBeInTheDocument()
    fireEvent.click(within(document.body).getByText('Istanbul'))
    fireEvent.click(screen.getByRole('button', { name: 'Submit Registration' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          city: 'Istanbul',
          cityId: '10',
          country: 'Turkey',
          websiteOrPublicProfile: 'https://aurora-clinic.example/',
        }),
      )
    })
  })

  it('submits a manually entered Turkish city when the city is not listed', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ClinicRegistrationForm cityOptions={cityOptions} onSubmit={onSubmit} />)

    fillRequiredFields()
    fireEvent.click(screen.getByRole('checkbox', { name: 'My city is not listed' }))
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'City' })).toHaveFocus()
    })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Mersin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Registration' }))

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          city: 'Mersin',
          cityId: '',
          country: 'Turkey',
          websiteOrPublicProfile: 'https://aurora-clinic.example/',
        }),
      )
    })
  })

  it('falls back to manual city entry when no city options are available', () => {
    render(<ClinicRegistrationForm cityOptions={[]} onSubmit={vi.fn().mockResolvedValue(undefined)} />)

    expect(screen.getByRole('checkbox', { name: 'My city is not listed' })).toBeChecked()
    expect(screen.getByLabelText('City')).toBeInTheDocument()
  })

  it('marks and focuses the city combobox when no listed city is selected', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ClinicRegistrationForm cityOptions={cityOptions} onSubmit={onSubmit} />)

    fillRequiredFields()
    fireEvent.click(screen.getByRole('button', { name: 'Submit Registration' }))

    await waitFor(() => {
      expect(screen.getByText('Select the clinic city or enter it manually.')).toBeVisible()
    })
    await waitFor(() => {
      expect(screen.getByRole('combobox', { name: 'City' })).toHaveFocus()
    })
    expect(screen.getByRole('combobox', { name: 'City' })).toHaveAttribute('aria-invalid', 'true')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('requires a website or public profile before submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ClinicRegistrationForm cityOptions={cityOptions} onSubmit={onSubmit} />)

    fillRequiredFields({ includeWebsite: false })
    fireEvent.click(screen.getByRole('checkbox', { name: 'My city is not listed' }))
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'City' })).toHaveFocus()
    })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Mersin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Registration' }))

    expect(screen.getByLabelText('Website or public profile')).toBeRequired()
    expect(screen.getByLabelText('Website or public profile')).not.toBeValid()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects invalid website or public profile values before submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<ClinicRegistrationForm cityOptions={cityOptions} onSubmit={onSubmit} />)

    fillRequiredFields()
    fireEvent.change(screen.getByLabelText('Website or public profile'), { target: { value: 'not-a-url' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'My city is not listed' }))
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: 'City' })).toHaveFocus()
    })
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Mersin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Submit Registration' }))

    await waitFor(() => {
      expect(screen.getByText('Enter a valid website or public profile URL.')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Website or public profile')).toHaveFocus()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
