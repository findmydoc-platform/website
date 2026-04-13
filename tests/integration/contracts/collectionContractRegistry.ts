export interface CollectionContractEntry {
  baseline: readonly string[]
  deep?: readonly string[]
}

export const collectionContractRegistry = {
  accreditation: {
    baseline: ['tests/integration/accreditation.lifecycle.test.ts'],
    deep: ['tests/integration/accreditation.lifecycle.test.ts'],
  },
  basicUsers: {
    baseline: ['tests/integration/basicUserLifecycle.test.ts'],
  },
  categories: {
    baseline: ['tests/integration/categories.lifecycle.test.ts'],
  },
  cities: {
    baseline: ['tests/integration/cities.creation.test.ts'],
  },
  clinicApplications: {
    baseline: ['tests/integration/clinicApplications.approval.test.ts'],
    deep: ['tests/integration/clinicApplications.approval.test.ts'],
  },
  clinicGalleryEntries: {
    baseline: ['tests/integration/clinicGalleryEntries.lifecycle.test.ts'],
    deep: [
      'tests/integration/clinicGalleryEntries.lifecycle.test.ts',
      'tests/integration/clinicGalleryEntries.validation.test.ts',
    ],
  },
  clinicGalleryMedia: {
    baseline: ['tests/integration/clinicGalleryMedia.lifecycle.test.ts'],
    deep: ['tests/integration/clinicGalleryMedia.lifecycle.test.ts'],
  },
  clinicMedia: {
    baseline: ['tests/integration/clinicMedia.lifecycle.test.ts'],
    deep: ['tests/integration/clinicMedia.lifecycle.test.ts'],
  },
  clinicStaff: {
    baseline: ['tests/integration/clinicStaff.lifecycle.test.ts'],
    deep: ['tests/integration/clinicStaff.lifecycle.test.ts', 'tests/integration/access/clinicStaff-access.test.ts'],
  },
  clinictreatments: {
    baseline: ['tests/integration/clinicTreatments.creation.test.ts'],
    deep: [
      'tests/integration/clinicTreatments.creation.test.ts',
      'tests/integration/clinicTreatments.averagePrice.test.ts',
    ],
  },
  clinics: {
    baseline: ['tests/integration/clinics.creation.test.ts'],
    deep: ['tests/integration/clinics.creation.test.ts', 'tests/integration/access/clinics-access.test.ts'],
  },
  countries: {
    baseline: ['tests/integration/countries.lifecycle.test.ts'],
  },
  doctorMedia: {
    baseline: ['tests/integration/doctorMedia.lifecycle.test.ts'],
    deep: ['tests/integration/doctorMedia.lifecycle.test.ts'],
  },
  doctors: {
    baseline: ['tests/integration/doctors.lifecycle.test.ts'],
    deep: ['tests/integration/doctors.lifecycle.test.ts', 'tests/integration/doctors.titles.test.ts'],
  },
  doctorspecialties: {
    baseline: ['tests/integration/doctorSpecialties.lifecycle.test.ts'],
    deep: ['tests/integration/doctorSpecialties.lifecycle.test.ts'],
  },
  doctortreatments: {
    baseline: ['tests/integration/doctorTreatments.lifecycle.test.ts'],
    deep: ['tests/integration/doctorTreatments.lifecycle.test.ts'],
  },
  favoriteclinics: {
    baseline: ['tests/integration/favoriteClinics.lifecycle.test.ts'],
    deep: [
      'tests/integration/favoriteClinics.lifecycle.test.ts',
      'tests/integration/access/favoriteClinics-access.test.ts',
    ],
  },
  'medical-specialties': {
    baseline: ['tests/integration/medicalSpecialties.lifecycle.test.ts'],
    deep: [
      'tests/integration/medicalSpecialties.lifecycle.test.ts',
      'tests/integration/medicalSpecialties.upsert.integration.test.ts',
    ],
  },
  pages: {
    baseline: ['tests/integration/pages.lifecycle.test.ts'],
    deep: ['tests/integration/pages.lifecycle.test.ts', 'tests/integration/access/pages-posts-access.test.ts'],
  },
  patients: {
    baseline: ['tests/integration/patientLifecycle.test.ts'],
    deep: ['tests/integration/patientLifecycle.test.ts'],
  },
  platformContentMedia: {
    baseline: ['tests/integration/platformContentMedia.lifecycle.test.ts'],
    deep: ['tests/integration/platformContentMedia.lifecycle.test.ts', 'tests/integration/access/media-access.test.ts'],
  },
  platformStaff: {
    baseline: ['tests/integration/platformStaff.lifecycle.test.ts'],
    deep: ['tests/integration/platformStaff.lifecycle.test.ts'],
  },
  posts: {
    baseline: ['tests/integration/posts.lifecycle.test.ts'],
    deep: ['tests/integration/posts.lifecycle.test.ts', 'tests/integration/access/pages-posts-access.test.ts'],
  },
  reviews: {
    baseline: ['tests/integration/reviews.lifecycle.test.ts'],
    deep: [
      'tests/integration/reviews.lifecycle.test.ts',
      'tests/integration/access/reviews-access.test.ts',
      'tests/integration/reviews.auditTrail.test.ts',
      'tests/integration/reviews.duplicateGuard.test.ts',
      'tests/integration/reviews.averageRatings.test.ts',
    ],
  },
  tags: {
    baseline: ['tests/integration/tags.associations.test.ts'],
  },
  treatments: {
    baseline: ['tests/integration/treatments.creation.test.ts'],
  },
  userProfileMedia: {
    baseline: ['tests/integration/userProfileMedia.lifecycle.test.ts'],
    deep: ['tests/integration/userProfileMedia.lifecycle.test.ts'],
  },
} as const satisfies Record<string, CollectionContractEntry>

export const prioritizedBaselineContractSlugs = [
  'clinicApplications',
  'clinicGalleryEntries',
  'doctorMedia',
  'doctortreatments',
  'userProfileMedia',
] as const

export const deepContractDomains = {
  clinicDoctorRelations: [
    'clinics',
    'doctors',
    'clinicStaff',
    'doctorspecialties',
    'doctortreatments',
    'clinictreatments',
  ],
  contentMediaRelations: [
    'clinicGalleryMedia',
    'clinicGalleryEntries',
    'platformContentMedia',
    'clinicMedia',
    'doctorMedia',
    'userProfileMedia',
  ],
  trustWorkflow: ['reviews', 'favoriteclinics', 'accreditation', 'clinicApplications', 'patients', 'platformStaff'],
} as const
