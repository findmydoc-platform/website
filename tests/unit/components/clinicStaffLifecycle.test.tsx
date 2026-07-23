// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import type { SelectFieldClientProps } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const adminState = vi.hoisted(() => ({
  fields: {} as Record<string, { value?: unknown }>,
  initialData: {} as Record<string, unknown>,
}))

vi.mock('@payloadcms/ui', () => ({
  SelectField: ({
    field,
  }: {
    field: { admin?: { readOnly?: boolean }; options: Array<{ label: string; value: string }> }
  }) => (
    <select aria-label="Status" disabled={field.admin?.readOnly}>
      {field.options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
  useDocumentInfo: () => ({ initialData: adminState.initialData }),
  useFormFields: (selector: (context: [Record<string, { value?: unknown }>, unknown]) => unknown) =>
    selector([adminState.fields, undefined]),
}))

import { ClinicStaffLifecyclePanel, ClinicStaffStatusField } from '@/app/(payload)/components/ClinicStaffLifecycle'

const statusFieldProps = {
  field: {
    admin: {},
    hasMany: false,
    name: 'status',
    options: [],
  },
  path: 'status',
} as unknown as SelectFieldClientProps

describe('ClinicStaff lifecycle Admin components', () => {
  beforeEach(() => {
    adminState.fields = {}
    adminState.initialData = {}
  })

  it('uses the saved status for options even after an unsaved selection', () => {
    adminState.initialData = { status: 'approved' }
    adminState.fields = {
      status: { value: 'disabled' },
      'authSync.status': { value: 'synced' },
    }

    render(
      <>
        <ClinicStaffStatusField {...statusFieldProps} />
        <ClinicStaffLifecyclePanel />
      </>,
    )

    const options = screen.getByLabelText('Status').querySelectorAll('option')
    expect(Array.from(options).map((option) => option.textContent)).toEqual(['Approved', 'Disabled', 'Offboarded'])
    expect(screen.queryByRole('option', { name: 'Rejected' })).not.toBeInTheDocument()
    expect(screen.getByText('Saving disables the Supabase identity.')).toBeVisible()
    expect(screen.getByText('Access removal selected')).toBeVisible()
  })

  it('renders offboarded as terminal and read-only', () => {
    adminState.initialData = { status: 'offboarded' }
    adminState.fields = {
      status: { value: 'offboarded' },
      'authSync.status': { value: 'deleted' },
    }

    render(
      <>
        <ClinicStaffStatusField {...statusFieldProps} />
        <ClinicStaffLifecyclePanel />
      </>,
    )

    const select = screen.getByLabelText('Status')
    expect(select).toBeDisabled()
    expect(select.querySelectorAll('option')).toHaveLength(1)
    expect(screen.getByText('No further lifecycle transition is available.')).toBeVisible()
  })

  it('shows the readable sync failure and retry path', () => {
    adminState.initialData = { status: 'approved' }
    adminState.fields = {
      status: { value: 'approved' },
      'authSync.errorCode': { value: 'account_update_failed' },
      'authSync.status': { value: 'failed' },
    }

    render(<ClinicStaffLifecyclePanel />)

    expect(screen.getByText('The last Supabase synchronization failed.')).toBeVisible()
    expect(screen.getByText('Account update failed')).toBeVisible()
    expect(screen.getByText('Saving this record again retries the same Supabase operation.')).toBeVisible()
  })
})
