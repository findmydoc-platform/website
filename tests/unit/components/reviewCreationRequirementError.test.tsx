// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const formState = vi.hoisted(() => ({
  fields: {} as Record<string, { value?: unknown }>,
  operation: 'create' as 'create' | 'update',
}))

vi.mock('@payloadcms/ui', () => ({
  FieldError: ({ message, showError }: { message?: string; showError?: boolean }) =>
    showError ? <span>{message}</span> : null,
  useFormFields: (selector: (context: [Record<string, { value?: unknown }>, unknown]) => unknown) =>
    selector([formState.fields, undefined]),
  useOperation: () => formState.operation,
}))

import { ReviewCreationRequirementError } from '@/app/(payload)/components/ReviewCreationRequirementError'

describe('ReviewCreationRequirementError', () => {
  beforeEach(() => {
    formState.fields = {}
    formState.operation = 'create'
  })

  it('renders the create-only patient requirement at the field', () => {
    render(<ReviewCreationRequirementError path="patient" />)

    expect(screen.getByText('Patient is required when creating a review.')).toBeInTheDocument()
  })

  it('does not add the create-only error during updates', () => {
    formState.operation = 'update'

    render(<ReviewCreationRequirementError path="patient" />)

    expect(screen.queryByText('Patient is required when creating a review.')).not.toBeInTheDocument()
  })
})
