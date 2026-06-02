import { describe, expect, test, vi } from 'vitest'
import type { Payload } from 'payload'

import { getClinicRegistrationTreatmentCategories } from '@/utilities/clinicRegistration/treatmentCategories'

describe('getClinicRegistrationTreatmentCategories', () => {
  test('uses top-level medical specialty icon keys from Payload', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [
          { id: 5, name: 'Plastic Surgery', iconKey: 'plastic-surgery', parentSpecialty: null },
          { id: 1, name: 'Dental', iconKey: 'dental', parentSpecialty: null },
          { id: 11, name: 'Implants', iconKey: 'dental', parentSpecialty: 1 },
        ],
      }),
    } as unknown as Payload

    await expect(getClinicRegistrationTreatmentCategories(payload)).resolves.toEqual([
      { id: '1', label: 'Dental', iconKey: 'dental' },
      { id: '5', label: 'Plastic Surgery', iconKey: 'plastic-surgery' },
    ])
    expect(payload.find).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'medical-specialties',
        select: expect.objectContaining({ iconKey: true }),
      }),
    )
  })

  test('uses the fallback icon for missing or invalid icon keys', async () => {
    const payload = {
      find: vi.fn().mockResolvedValue({
        docs: [
          { id: 7, name: 'Unknown Specialty', parentSpecialty: null },
          { id: 8, name: 'Legacy Specialty', iconKey: 'legacy-icon', parentSpecialty: null },
        ],
      }),
    } as unknown as Payload

    await expect(getClinicRegistrationTreatmentCategories(payload)).resolves.toEqual([
      { id: '8', label: 'Legacy Specialty', iconKey: 'fallback' },
      { id: '7', label: 'Unknown Specialty', iconKey: 'fallback' },
    ])
  })
})
