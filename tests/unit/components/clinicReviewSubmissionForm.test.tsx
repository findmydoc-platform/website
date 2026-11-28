// @vitest-environment jsdom
import '@testing-library/jest-dom'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'

import { ClinicReviewSubmissionForm } from '@/components/organisms/ClinicDetail/ClinicReviewSubmissionForm'
import { getClinicReviewsCopy } from '@/features/clinicDetail/reviewsCopy'
import type { ClinicReviewSubmissionResult } from '@/features/clinicDetail/reviewSubmission'

it('validates required review fields inline and shows success only after an accepted submission', async () => {
  let completeSubmission!: (result: ClinicReviewSubmissionResult) => void
  const onSubmit = vi.fn(() => new Promise<ClinicReviewSubmissionResult>((resolve) => (completeSubmission = resolve)))
  const comment = 'Ein persönlicher Erfahrungsbericht.\n\nMit zweitem Absatz.'
  render(
    <ClinicReviewSubmissionForm
      copy={getClinicReviewsCopy('de').form}
      doctors={[{ id: '2', name: 'Dr. Grace' }]}
      treatments={[{ id: '3', name: 'Ultraschall' }]}
      loginHref="/login/patient"
      onSubmit={onSubmit}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: 'Bewertung schreiben' }))
  const form = within(screen.getByRole('form'))
  const doctor = form.getByRole('combobox', { name: 'Ärztin oder Arzt' })
  fireEvent.click(form.getByRole('button', { name: 'Bewertung absenden' }))

  expect(onSubmit).not.toHaveBeenCalled()
  expect(doctor).toHaveFocus()
  expect(doctor).toHaveAttribute('aria-invalid', 'true')
  expect(doctor.getAttribute('aria-describedby')).toBeTruthy()

  fireEvent.change(doctor, { target: { value: '2' } })
  fireEvent.change(form.getByRole('combobox', { name: 'Behandlung' }), { target: { value: '3' } })
  fireEvent.change(form.getByRole('combobox', { name: /1 bis 5 Sterne/ }), { target: { value: '4' } })
  fireEvent.change(form.getByRole('textbox', { name: 'Bewertungstext' }), { target: { value: comment } })
  fireEvent.click(form.getByRole('button', { name: 'Bewertung absenden' }))

  expect(onSubmit).toHaveBeenCalledExactlyOnceWith({
    doctorId: 2,
    treatmentId: 3,
    rating: 4,
    comment,
    allowName: false,
  })
  expect(form.getByRole('button')).toBeDisabled()
  expect(screen.queryByRole('status')).not.toBeInTheDocument()

  completeSubmission('pending')
  expect(await screen.findByRole('status')).toBeVisible()
  expect(screen.queryByRole('form')).not.toBeInTheDocument()
})
