import { describe, expect, it } from 'vitest'
import { clinicMediaGalleryActionUrl } from '@/app/(payload)/components/ClinicMediaGalleryAction/actionUrl'

describe('clinic media gallery action URL', () => {
  it('appends the gallery route before Payload document query parameters', () => {
    expect(clinicMediaGalleryActionUrl('/api/clinicMedia/1?locale=en', 'http://localhost:3000')).toBe(
      'http://localhost:3000/api/clinicMedia/1/profile-gallery?locale=en',
    )
  })
})
