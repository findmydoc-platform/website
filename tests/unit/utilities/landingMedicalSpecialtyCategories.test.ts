import { describe, expect, it } from 'vitest'

import { mapMedicalSpecialtiesToLandingCategories } from '@/utilities/landing/medicalSpecialtyCategories'

describe('landing medical specialty mapper', () => {
  it('maps L1 specialties to tabs and L2 specialties to cards only', () => {
    const mapped = mapMedicalSpecialtiesToLandingCategories([
      {
        id: 1,
        name: 'Dental',
        description: 'Root category',
      },
      {
        id: 2,
        name: 'Eyes',
        description: 'Root category',
      },
      {
        id: 3,
        name: 'Skin',
        description: 'Root category without children',
      },
      {
        id: 11,
        name: 'Implants',
        description: 'Method family',
        parentSpecialty: 1,
        icon: {
          id: 400,
          url: '/api/platformContentMedia/file/implants.jpg',
          alt: 'Implants icon',
        },
      },
      {
        id: 12,
        name: 'Orthodontics',
        description: 'Method family',
        parentSpecialty: {
          id: 1,
        },
      },
      {
        id: 21,
        name: 'LASIK',
        description: 'Method family',
        parentSpecialty: 2,
      },
      {
        id: 31,
        name: 'Femto-LASIK',
        description: 'Level 3 procedure',
        parentSpecialty: 21,
      },
      {
        id: 41,
        name: 'Orphan Method',
        description: 'Missing parent relation',
        parentSpecialty: 999,
      },
      {
        id: 51,
        name: 'All-on-4',
        description: 'Excluded level 3 candidate by name',
        parentSpecialty: 1,
      },
    ])

    expect(mapped.categories).toEqual([
      { label: 'Dental', value: '1' },
      { label: 'Eyes', value: '2' },
    ])

    expect(mapped.items.map((item) => item.title)).toEqual(['Implants', 'Orthodontics', 'LASIK'])
    expect(mapped.items.every((item) => item.href === `/listing-comparison?specialty=${item.id}`)).toBe(true)
    expect(mapped.items.map((item) => item.categories[0])).toEqual(['1', '1', '2'])
    expect(mapped.featuredIds).toEqual(['11', '12', '21'])
  })

  it('uses a deterministic placeholder when icon media is missing', () => {
    const mapped = mapMedicalSpecialtiesToLandingCategories([
      {
        id: 100,
        name: 'Hair',
      },
      {
        id: 101,
        name: 'Hair Regeneration',
        parentSpecialty: 100,
      },
    ])

    expect(mapped.items).toHaveLength(1)
    expect(mapped.items[0]?.image.src).toBe('/images/placeholder-576-968.svg')
  })
})
