import { describe, expect, it } from 'vitest'

import { Reviews } from '@/collections/Reviews'

describe('Reviews schema', () => {
  it('enforces one review per patient, clinic, doctor, and treatment at the database level', () => {
    expect(Reviews.indexes).toContainEqual({
      fields: ['patient', 'clinic', 'doctor', 'treatment'],
      unique: true,
    })
  })
})
