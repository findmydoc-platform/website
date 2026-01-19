import type { CollectionSlug } from 'payload'
import type { RelationMapping } from './import-collection'

type CollectionPlanStep = {
  kind: 'collection'
  name: string
  collection: CollectionSlug
  fileName: string
  mapping?: RelationMapping[]
}

type GlobalsPlanStep = {
  kind: 'globals'
  name: string
  fileName: string
}

export type SeedPlanStep = CollectionPlanStep | GlobalsPlanStep

export const baselinePlan: SeedPlanStep[] = [
  { kind: 'globals', name: 'globals', fileName: 'globals' },
  { kind: 'collection', name: 'countries', collection: 'countries', fileName: 'countries' },
  {
    kind: 'collection',
    name: 'cities',
    collection: 'cities',
    fileName: 'cities',
    mapping: [
      {
        sourceField: 'countryStableId',
        targetField: 'country',
        collection: 'countries',
        required: true,
      },
    ],
  },
  {
    kind: 'collection',
    name: 'medical-specialties',
    collection: 'medical-specialties',
    fileName: 'medicalSpecialties',
    mapping: [
      {
        sourceField: 'parentSpecialtyStableId',
        targetField: 'parentSpecialty',
        collection: 'medical-specialties',
      },
    ],
  },
  { kind: 'collection', name: 'accreditations', collection: 'accreditation', fileName: 'accreditations' },
  { kind: 'collection', name: 'tags', collection: 'tags', fileName: 'tags' },
  { kind: 'collection', name: 'categories', collection: 'categories', fileName: 'categories' },
  {
    kind: 'collection',
    name: 'treatments',
    collection: 'treatments',
    fileName: 'treatments',
    mapping: [
      {
        sourceField: 'medicalSpecialtyStableId',
        targetField: 'medicalSpecialty',
        collection: 'medical-specialties',
        required: true,
      },
      {
        sourceField: 'tagsStableIds',
        targetField: 'tags',
        collection: 'tags',
        many: true,
      },
    ],
  },
]

export const demoPlan: SeedPlanStep[] = [
  {
    kind: 'collection',
    name: 'posts',
    collection: 'posts',
    fileName: 'posts',
    mapping: [
      {
        sourceField: 'tagsStableIds',
        targetField: 'tags',
        collection: 'tags',
        many: true,
      },
      {
        sourceField: 'categoriesStableIds',
        targetField: 'categories',
        collection: 'categories',
        many: true,
      },
    ],
  },
  {
    kind: 'collection',
    name: 'clinics',
    collection: 'clinics',
    fileName: 'clinics',
    mapping: [
      {
        sourceField: 'cityStableId',
        targetField: 'address.city',
        collection: 'cities',
        required: true,
      },
      {
        sourceField: 'tagsStableIds',
        targetField: 'tags',
        collection: 'tags',
        many: true,
      },
      {
        sourceField: 'accreditationsStableIds',
        targetField: 'accreditations',
        collection: 'accreditation',
        many: true,
      },
    ],
  },
  {
    kind: 'collection',
    name: 'doctors',
    collection: 'doctors',
    fileName: 'doctors',
    mapping: [
      {
        sourceField: 'clinicStableId',
        targetField: 'clinic',
        collection: 'clinics',
        required: true,
      },
    ],
  },
  {
    kind: 'collection',
    name: 'clinic-treatments',
    collection: 'clinictreatments',
    fileName: 'clinicTreatments',
    mapping: [
      {
        sourceField: 'clinicStableId',
        targetField: 'clinic',
        collection: 'clinics',
        required: true,
      },
      {
        sourceField: 'treatmentStableId',
        targetField: 'treatment',
        collection: 'treatments',
        required: true,
      },
    ],
  },
  {
    kind: 'collection',
    name: 'doctor-specialties',
    collection: 'doctorspecialties',
    fileName: 'doctorSpecialties',
    mapping: [
      {
        sourceField: 'doctorStableId',
        targetField: 'doctor',
        collection: 'doctors',
        required: true,
      },
      {
        sourceField: 'medicalSpecialtyStableId',
        targetField: 'medicalSpecialty',
        collection: 'medical-specialties',
        required: true,
      },
    ],
  },
  {
    kind: 'collection',
    name: 'doctor-treatments',
    collection: 'doctortreatments',
    fileName: 'doctorTreatments',
    mapping: [
      {
        sourceField: 'doctorStableId',
        targetField: 'doctor',
        collection: 'doctors',
        required: true,
      },
      {
        sourceField: 'treatmentStableId',
        targetField: 'treatment',
        collection: 'treatments',
        required: true,
      },
    ],
  },
  {
    kind: 'collection',
    name: 'reviews',
    collection: 'reviews',
    fileName: 'reviews',
    mapping: [
      {
        sourceField: 'clinicStableId',
        targetField: 'clinic',
        collection: 'clinics',
        required: true,
      },
      {
        sourceField: 'doctorStableId',
        targetField: 'doctor',
        collection: 'doctors',
        required: true,
      },
      {
        sourceField: 'treatmentStableId',
        targetField: 'treatment',
        collection: 'treatments',
        required: true,
      },
      {
        sourceField: 'patientStableId',
        targetField: 'patient',
        collection: 'platformStaff',
      },
    ],
  },
  {
    kind: 'collection',
    name: 'favorite-clinics',
    collection: 'favoriteclinics',
    fileName: 'favoriteClinics',
    mapping: [
      {
        sourceField: 'patientStableId',
        targetField: 'patient',
        collection: 'patients',
        required: true,
      },
      {
        sourceField: 'clinicStableId',
        targetField: 'clinic',
        collection: 'clinics',
        required: true,
      },
    ],
  },
]
