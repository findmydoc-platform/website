import { describe, expect, it } from 'vitest'

import { validateClinicTreatmentPrice } from '@/collections/ClinicTreatments/priceValidation'

describe('clinic treatment EUR price contract', () => {
  it.each([0, 12, 12.3, 12.34])('accepts %s EUR', async (value) => {
    expect(await validateClinicTreatmentPrice(value, {} as never)).toBe(true)
  })

  it.each([-0.01, 12.345])('rejects %s EUR', async (value) => {
    expect(await validateClinicTreatmentPrice(value, {} as never)).not.toBe(true)
  })
})
