import { describe, expect, it } from 'vitest'
import { loadSeedFile } from '@/endpoints/seed/utils/load-json'

const coastal = 'seed-group-coastal'

describe('group-access acceptance seed data', () => {
  it('provides distinguishable eligible clinics including an unpublished member, a foreign group and an independent clinic', async () => {
    const clinics = await loadSeedFile('demo', 'clinics')
    const own = clinics.filter(
      (clinic) => clinic.groupStableId === coastal && clinic.participationStatus === 'approved',
    )
    expect(own.map((clinic) => clinic.stableId).sort()).toEqual([
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'seed-clinic-istanbul-bosphorus',
      'seed-clinic-izmir-coast',
    ])
    expect(new Set(own.map((clinic) => clinic.name)).size).toBe(3)
    expect(own.find((clinic) => clinic.stableId === 'seed-clinic-istanbul-bosphorus')).toMatchObject({
      status: 'pending',
      participationStatus: 'approved',
    })
    expect(clinics.find((clinic) => clinic.stableId === 'seed-clinic-ankara-harmony')).toMatchObject({
      groupStableId: 'seed-group-capital',
      participationStatus: 'approved',
    })
    expect(clinics.find((clinic) => clinic.stableId === 'seed-clinic-antalya-medvista')).toMatchObject({
      group: null,
      participationStatus: 'approved',
    })
  })
})

it('provides non-credential scenario descriptors whose exact source targets stay inside their named clinics', async () => {
  const manifest = await import('@/endpoints/seed/data/demo/groupAccessScenarios.json').then((module) => module.default)
  const clinics = await loadSeedFile('demo', 'clinics')
  const reviews = await loadSeedFile('demo', 'reviews')
  const doctors = await loadSeedFile('demo', 'doctors')
  expect(manifest.personas).toHaveLength(2)
  for (const persona of manifest.personas) {
    expect(persona.preparation).toBe('trusted-personal-group-invitation')
    expect(persona).not.toHaveProperty('email')
  }
  for (const target of manifest.sourceTargets) {
    expect(clinics.some((clinic) => clinic.stableId === target.clinicStableId)).toBe(true)
    expect(reviews.find((review) => review.stableId === target.reviewStableId)?.clinicStableId).toBe(
      target.clinicStableId,
    )
    expect(doctors.find((doctor) => doctor.stableId === target.doctorStableId)?.clinicStableId).toBe(
      target.clinicStableId,
    )
  }
  expect(manifest.scenarios.map((scenario) => scenario.key).sort()).toEqual([
    'draft-protection',
    'exact-notification-target',
    'independent-local',
    'invalid-activation',
    'last-used-fallback',
    'local-within-group',
    'membership-movement',
    'multiple-clinics',
    'per-clinic-reporting',
    'revocation',
    'unpublished-participation',
    'zero-eligible-clinics',
  ])
  expect(JSON.stringify(manifest)).not.toMatch(
    /password|secret|token|supabaseUserId|activationReadiness|accountCompletion/,
  )
})
