import { describe, expect, it } from 'vitest'

import {
  buildContactRequestMessage,
  computeNextVisibleFurtherTreatmentCount,
  resolveDoctorSelectionToggle,
  sanitizeSelectedId,
} from '@/components/templates/ClinicDetailConcepts/hooks/clinicDetailInteraction.logic'

describe('clinicDetailInteraction.logic', () => {
  it('sanitizes selected id against available ids', () => {
    expect(sanitizeSelectedId('doctor-1', ['doctor-1', 'doctor-2'])).toBe('doctor-1')
    expect(sanitizeSelectedId('doctor-9', ['doctor-1', 'doctor-2'])).toBe('')
    expect(sanitizeSelectedId('', ['doctor-1'])).toBe('')
  })

  it('increments further treatment visibility in page-sized steps', () => {
    expect(computeNextVisibleFurtherTreatmentCount(6, 6)).toBe(12)
    expect(computeNextVisibleFurtherTreatmentCount(0, 10)).toBe(10)
    expect(computeNextVisibleFurtherTreatmentCount(-5, 10)).toBe(10)
  })

  it('toggles doctor selection and scroll intent correctly', () => {
    expect(resolveDoctorSelectionToggle('', 'doctor-1')).toEqual({
      nextActiveHeroDoctorId: 'doctor-1',
      nextSelectedDoctorId: 'doctor-1',
      shouldScrollToOurDoctors: true,
    })

    expect(resolveDoctorSelectionToggle('doctor-1', 'doctor-1')).toEqual({
      nextActiveHeroDoctorId: '',
      nextSelectedDoctorId: '',
      shouldScrollToOurDoctors: false,
    })
  })

  it('builds contact placeholder status message with fallbacks', () => {
    expect(
      buildContactRequestMessage({
        doctorName: 'Dr. Ada',
        treatmentName: 'Routine Checkup',
      }),
    ).toBe('Contact request prepared for Dr. Ada and Routine Checkup.')

    expect(buildContactRequestMessage({})).toBe(
      'Contact request prepared for no doctor selected and no treatment selected.',
    )
  })
})
