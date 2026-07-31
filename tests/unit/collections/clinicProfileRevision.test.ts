import { describe, expect, it } from 'vitest'

import { setClinicProfileRevision } from '@/collections/clinics/profileRevision'

const runHook = (args: Record<string, unknown>) =>
  setClinicProfileRevision(args as Parameters<typeof setClinicProfileRevision>[0])

describe('clinic profile revision', () => {
  it('starts new clinics at revision zero', () => {
    expect(runHook({ data: { name: 'Clinic' }, operation: 'create' })).toMatchObject({
      profileRevision: 0,
    })
  })

  it('increments when a published profile field changes', () => {
    expect(
      runHook({
        data: { address: { street: 'New street' } },
        operation: 'update',
        originalDoc: { profileRevision: 4 },
      }),
    ).toMatchObject({ profileRevision: 5 })
  })

  it('does not increment for unrelated clinic fields', () => {
    expect(
      runHook({
        data: { coordinates: [29, 41] },
        operation: 'update',
        originalDoc: { profileRevision: 4 },
      }),
    ).toMatchObject({ profileRevision: 4 })
  })
})
