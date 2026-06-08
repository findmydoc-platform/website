import type { Payload } from 'payload'

import type {
  Accreditation,
  City,
  Clinic,
  ClinicGalleryEntry,
  Clinictreatment,
  Doctor,
  Doctorspecialty,
  Review,
} from '@/payload-types'
import type { ClinicDetailData } from '@/components/templates/ClinicDetailConcepts/types'

export type ClinicDetailServerDataOptions = {
  draft: boolean
}

export type ClinicDetailRepositoryContext = {
  payload: Payload
}

export type ClinicDetailMappingArgs = {
  clinic: Clinic
  clinicTreatments: Clinictreatment[]
  doctors: Doctor[]
  doctorSpecialties: Doctorspecialty[]
  clinicReviewCount: number
  approvedClinicReviews: Review[]
  doctorReviewCounts: Map<number, number>
  galleryEntries: ClinicGalleryEntry[]
  accreditations: Accreditation[]
  cities: City[]
}

export type ClinicDetailServerDataResult = ClinicDetailData | null
