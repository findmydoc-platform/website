import { describe, expect, it } from 'vitest'
import { ClinicProfileDrafts } from '@/collections/ClinicProfileDrafts'
import { FavoriteClinics } from '@/collections/FavoriteClinics'

describe('operational Admin collection visibility', () => {
  it('hides dashboard drafts and patient favorites through the Payload Admin configuration contract', () => {
    expect(ClinicProfileDrafts.admin?.hidden).toBe(true)
    expect(FavoriteClinics.admin?.hidden).toBe(true)
  })
})
