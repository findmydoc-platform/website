import { describe, expect, it } from 'vitest'
import { AuthActions } from '@/collections/AuthActions'
import { ClinicProfileDrafts } from '@/collections/ClinicProfileDrafts'
import { FavoriteClinics } from '@/collections/FavoriteClinics'
import { createMockReq } from '../helpers/testHelpers'

describe('operational Admin collection visibility', () => {
  it('excludes dashboard drafts and patient favorites from Admin navigation and routes', () => {
    expect(ClinicProfileDrafts.admin?.hidden).toBe(true)
    expect(FavoriteClinics.admin?.hidden).toBe(true)
  })

  it('keeps safe AuthActions diagnostics visible to Support without generic write access', async () => {
    const req = createMockReq({ id: 7, collection: 'platformStaff', role: 'support' })
    expect(AuthActions.admin?.hidden).not.toBe(true)
    expect(await AuthActions.access?.admin?.({ req })).toBe(true)
    expect(await AuthActions.access?.read?.({ req })).toBe(true)
    for (const operation of ['create', 'update', 'delete'] as const) {
      expect(await AuthActions.access?.[operation]?.({ req })).toBe(false)
    }
  })
})
