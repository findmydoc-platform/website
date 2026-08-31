import type { Payload } from 'payload'

import type {
  Accreditation,
  City,
  Clinic,
  Clinictreatment,
  Doctor,
  Doctorspecialty,
  Review,
  ReviewResponse,
} from '@/payload-types'
import type { ClinicDetailData } from '@/features/clinicDetail/contracts'
import type { MediaDescriptor } from '@/utilities/media/relationMedia'

export type ClinicDetailServerDataOptions = {
  draft: boolean
}

export type ClinicDetailRepositoryContext = {
  payload: Payload
}

export type ClinicDetailMappingArgs = {
  clinic: Clinic
  heroImage: {
    src: string
    alt: string
  }
  galleryImages: ClinicDetailData['galleryImages']
  doctorMediaByDoctorId?: ReadonlyMap<number, MediaDescriptor>
  clinicTreatments: Clinictreatment[]
  doctors: Doctor[]
  doctorSpecialties: Doctorspecialty[]
  clinicReviewCount: number
  approvedClinicReviews: Review[]
  reviewResponses: ReviewResponse[]
  doctorReviewCounts: Map<number, number>
  accreditations: Accreditation[]
  cities: City[]
}

export type ClinicDetailServerDataResult = ClinicDetailData | null
