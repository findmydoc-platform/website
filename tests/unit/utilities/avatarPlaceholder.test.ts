import { describe, expect, it } from 'vitest'

import { resolveAvatarPlaceholder } from '@/utilities/placeholders/avatar'

describe('resolveAvatarPlaceholder', () => {
  it('resolves doctor placeholders by explicit gender', () => {
    expect(resolveAvatarPlaceholder({ persona: 'doctor', gender: 'female' })).toBe(
      '/images/avatar-doctor-female-placeholder.svg',
    )
    expect(resolveAvatarPlaceholder({ persona: 'doctor', gender: 'male' })).toBe(
      '/images/avatar-doctor-male-placeholder.svg',
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
    expect(resolveAvatarPlaceholder({ persona: 'doctor' })).toBe('/images/avatar-placeholder.svg')
    expect(resolveAvatarPlaceholder({ persona: 'patient' })).toBe('/images/avatar-placeholder.svg')
  })
})
