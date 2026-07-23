// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const formState = vi.hoisted(() => ({
  fields: {} as Record<string, { value?: unknown }>,
}))

vi.mock('@payloadcms/ui', () => ({
  FieldError: ({ message, showError }: { message?: string; showError?: boolean }) =>
    showError ? <span>{message}</span> : null,
  useFormFields: (selector: (context: [Record<string, { value?: unknown }>, unknown]) => unknown) =>
    selector([formState.fields, undefined]),
}))

import {
  ClinicApprovalRequirementError,
  ClinicApprovalRequirements,
} from '@/app/(payload)/components/ClinicApprovalRequirements'

describe('ClinicApprovalRequirements', () => {
  beforeEach(() => {
    formState.fields = {}
  })

  it('explains approval requirements without blocking a pending clinic', () => {
    formState.fields = {
      status: { value: 'pending' },
    }

    render(<ClinicApprovalRequirements />)

    expect(screen.getByRole('heading', { name: 'Approval requirements' })).toBeInTheDocument()
    expect(screen.getByText('These values become required when the clinic status is Approved.')).toBeInTheDocument()
    expect(screen.getAllByText('Missing')).toHaveLength(10)
  })

  it('announces missing requirements for an approved clinic', () => {
    formState.fields = {
      status: { value: 'approved' },
    }

    render(<ClinicApprovalRequirements />)

    expect(screen.getByText('10 requirements are incomplete.')).toBeInTheDocument()
  })

  it('renders the collection rule as a field-local approval error', () => {
    formState.fields = {
      'address.country': { value: '' },
      status: { value: 'approved' },
    }

    render(<ClinicApprovalRequirementError path="address.country" />)

    expect(screen.getByText('Country is required before this clinic can be approved.')).toBeInTheDocument()
  })

  it('shows when every approval requirement is complete', () => {
    formState.fields = {
      'address.city': { value: 1 },
      'address.country': { value: 'Turkey' },
      'address.houseNumber': { value: '12A' },
      'address.street': { value: 'Clinic Street' },
      'address.zipCode': { value: 34000 },
      'internalPrimaryContact.email': { value: 'clinic@example.com' },
      'internalPrimaryContact.firstName': { value: 'Aylin' },
      'internalPrimaryContact.lastName': { value: 'Korkmaz' },
      'internalPrimaryContact.role': { value: 'Clinic Management' },
      status: { value: 'approved' },
      supportedLanguages: { value: ['english'] },
    }

    render(<ClinicApprovalRequirements />)

    expect(screen.getByText('All requirements are complete.')).toBeInTheDocument()
    expect(screen.getAllByText('Complete')).toHaveLength(10)
  })
})
