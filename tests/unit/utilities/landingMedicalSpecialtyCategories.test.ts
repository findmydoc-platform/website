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
        featureImage: {
          id: 400,
          url: '/api/platformContentMedia/file/implants.jpg',
          alt: 'Implants feature image',
          sizes: {
            xlarge: {
              url: '/api/platformContentMedia/file/implants-1920.webp',
              width: 1920,
              height: 1280,
            },
          },
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
    expect(mapped.featuredIds).toEqual(['11', '21', '12'])
    expect(mapped.items[0]?.image).toMatchObject({
      src: '/api/platformContentMedia/file/implants-1920.webp',
      alt: 'Implants feature image',
      sizes: '(min-width: 1024px) 45vw, (min-width: 768px) 50vw, 100vw',
      quality: 85,
    })
  })

  it('uses a deterministic placeholder when feature image media is missing', () => {
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
    expect(mapped.items[0]?.image).toMatchObject({
      src: '/images/placeholders/clinic-placeholder.webp',
      quality: 85,
    })
  })

  it('round-robins featured cards across top-level categories for the all view', () => {
    const mapped = mapMedicalSpecialtiesToLandingCategories([
      { id: 1, name: 'Dental' },
      { id: 2, name: 'Eye Care' },
      { id: 3, name: 'Hair Restoration' },
      { id: 11, name: 'Cosmetic Dentistry', parentSpecialty: 1 },
      { id: 12, name: 'Dental Implants', parentSpecialty: 1 },
      { id: 21, name: 'Cornea', parentSpecialty: 2 },
      { id: 22, name: 'Lens Surgery', parentSpecialty: 2 },
      { id: 31, name: 'Hair Loss Therapy', parentSpecialty: 3 },
      { id: 32, name: 'Scalp Hair Transplant', parentSpecialty: 3 },
    ])

    expect(mapped.items.map((item) => item.title)).toEqual([
      'Cosmetic Dentistry',
      'Dental Implants',
      'Cornea',
      'Lens Surgery',
      'Hair Loss Therapy',
      'Scalp Hair Transplant',
    ])
    expect(mapped.featuredIds).toEqual(['11', '21', '31', '12'])
  })
})
