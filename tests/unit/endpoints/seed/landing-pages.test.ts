import type { Payload } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { prepareLandingPagesSeedData } from '@/endpoints/seed/utils/landing-pages'

const createPayload = (idsByStableId: Record<string, number>): Payload =>
  ({
    find: vi.fn().mockImplementation(({ where }) => {
      const stableId = where?.stableId?.equals
      const id = typeof stableId === 'string' ? idsByStableId[stableId] : undefined

      return Promise.resolve({
        docs: id == null ? [] : [{ id }],
      })
    }),
  }) as unknown as Payload

const createLandingPagesSeedData = () => ({
  home: {
    hero: { imageStableId: 'home-hero' },
    features: { backgroundImageStableId: 'home-feature' },
    testimonials: [{ imageStableId: 'home-testimonial' }],
    process: {
      steps: [{ imageStableId: 'home-process' }],
    },
  },
  clinicPartners: {
    hero: { imageStableId: 'clinic-hero' },
    process: {
      steps: [{ imageStableId: 'clinic-process' }],
    },
    team: [{ imageStableId: 'team-member' }],
    testimonials: [{ imageStableId: 'clinic-testimonial' }],
  },
})

describe('prepareLandingPagesSeedData', () => {
  it('resolves landing media stable IDs into platformContentMedia relationship IDs', async () => {
    const payload = createPayload({
      'home-hero': 101,
      'home-feature': 102,
      'home-testimonial': 103,
      'home-process': 104,
      'clinic-hero': 201,
      'clinic-process': 202,
      'team-member': 203,
      'clinic-testimonial': 204,
    })

    const prepared = await prepareLandingPagesSeedData(payload, createLandingPagesSeedData())

    expect(prepared).toMatchObject({
      home: {
        hero: { image: 101 },
        features: { backgroundImage: 102 },
        testimonials: [{ image: 103 }],
        process: { steps: [{ image: 104 }] },
      },
      clinicPartners: {
        hero: { image: 201 },
        process: { steps: [{ image: 202 }] },
        team: [{ image: 203 }],
        testimonials: [{ image: 204 }],
      },
    })
    expect(JSON.stringify(prepared)).not.toContain('StableId')
  })

  it('fails clearly when a required landing media stable ID is missing', async () => {
    const payload = createPayload({
      'home-feature': 102,
      'home-testimonial': 103,
      'home-process': 104,
      'clinic-hero': 201,
      'clinic-process': 202,
      'team-member': 203,
      'clinic-testimonial': 204,
    })

    await expect(prepareLandingPagesSeedData(payload, createLandingPagesSeedData())).rejects.toThrow(
      'Landing pages media stableId home-hero for home.hero.image was not found',
    )
  })
})
