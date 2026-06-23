import { describe, expect, it } from 'vitest'

import { resolveAvatarPlaceholder } from '@/utilities/placeholders/avatar'

describe('resolveAvatarPlaceholder', () => {
  it('resolves doctor placeholders by explicit gender', () => {
    expect(resolveAvatarPlaceholder({ persona: 'doctor', gender: 'female' })).toBe(
      '/images/placeholders/doctor-female-placeholder.webp',
    )
    expect(resolveAvatarPlaceholder({ persona: 'doctor', gender: 'male' })).toBe(
      '/images/placeholders/doctor-male-placeholder.webp',
    )
  })

  it('resolves patient placeholders by explicit gender', () => {
    expect(resolveAvatarPlaceholder({ persona: 'patient', gender: 'female' })).toBe(
      '/images/avatar-patient-female-placeholder.svg',
    )
    expect(resolveAvatarPlaceholder({ persona: 'patient', gender: 'male' })).toBe(
      '/images/avatar-patient-male-placeholder.svg',
    )
  })

  it('uses neutral fallback when gender is not provided', () => {
    expect(resolveAvatarPlaceholder({ persona: 'doctor' })).toBe('/images/placeholders/doctor-neutral-placeholder.webp')
    expect(resolveAvatarPlaceholder({ persona: 'patient' })).toBe('/images/avatar-placeholder.svg')
  })
})
