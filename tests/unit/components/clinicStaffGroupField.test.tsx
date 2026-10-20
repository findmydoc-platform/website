// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import type { RelationshipFieldClientProps } from 'payload'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ submitted: false, valid: false, errorMessage: '' }))
vi.mock('@payloadcms/ui', () => ({
  RelationshipField: () => <input aria-label="Group" role="combobox" />,
  useFormFields: (selector: (context: [Record<string, typeof state>]) => unknown) => selector([{ group: state }]),
  useFormSubmitted: () => state.submitted,
}))

import { ClinicStaffGroupField } from '@/app/(payload)/components/ClinicStaffGroupField'

const props = { path: 'group', field: { name: 'group', relationTo: 'clinicGroups' } } as RelationshipFieldClientProps

describe('Clinic staff group field validation', () => {
  beforeEach(() => {
    state.submitted = false
    state.valid = false
    state.errorMessage = ''
  })

  it('associates the visible validation error with its accessible field group and clears it after correction', () => {
    state.submitted = true
    state.errorMessage = 'Group is required for group scope.'
    const { rerender } = render(<ClinicStaffGroupField {...props} />)
    const group = screen.getByRole('group', { name: 'Group' })
    expect(screen.getByRole('alert')).toBeVisible()
    expect(group).toHaveAttribute('aria-invalid', 'true')
    expect(group).toHaveAccessibleDescription(state.errorMessage)
    expect(group).toContainElement(screen.getByRole('combobox'))

    state.valid = true
    state.errorMessage = ''
    rerender(<ClinicStaffGroupField {...props} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(group).not.toHaveAttribute('aria-invalid')
    expect(group).not.toHaveAttribute('aria-describedby')
  })

  it('does not announce an unsubmitted error', () => {
    state.errorMessage = 'Group is required for group scope.'
    render(<ClinicStaffGroupField {...props} />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
