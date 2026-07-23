import type { AdminJourneyDefinition } from './types'
import { clinicApprovalJourney, clinicCreateDraftJourney, clinicTreatmentJoinJourney } from './journeys/clinics'
import { clinicApplicationLifecycleJourney, clinicStaffLifecycleJourney } from './journeys/clinicLifecycle'
import { reviewPatientValidationJourney } from './journeys/reviews'
import { relationshipEligibilityJourney } from './journeys/relationshipEligibility'
import {
  clinicDoctorSpecialtyJourney,
  doctorSpecialtyLinkJourney,
  medicalNetworkRegressionJourney,
  medicalSpecialtyCreateJourney,
} from './journeys/specialties'
import { tagCreateJourney } from './journeys/tags'
import {
  clinicDoctorTreatmentJourney,
  clinicTreatmentLinkJourney,
  doctorTreatmentLinkJourney,
  treatmentCreateJourney,
  treatmentJoinClinicJourney,
  treatmentJoinDoctorJourney,
  treatmentMedicalNetworkJourney,
} from './journeys/treatments'

export const adminJourneyRegistry = {
  'admin.clinic-applications.provisioning-guidance': clinicApplicationLifecycleJourney,
  'admin.clinic-staff.lifecycle-guidance': clinicStaffLifecycleJourney,
  'admin.clinics.approve-pending': clinicApprovalJourney,
  'admin.clinics.create-draft': clinicCreateDraftJourney,
  'admin.clinictreatments.create-link': clinicTreatmentLinkJourney,
  'admin.doctorspecialties.create-link': doctorSpecialtyLinkJourney,
  'admin.doctortreatments.create-link': doctorTreatmentLinkJourney,
  'admin.medical-network.create-specialty-and-link-doctor': medicalNetworkRegressionJourney,
  'admin.medical-network.create-treatment-and-link-clinic-and-doctor': treatmentMedicalNetworkJourney,
  'admin.medical-specialties.create': medicalSpecialtyCreateJourney,
  'admin.reviews.validate-patient': reviewPatientValidationJourney,
  'admin.relationships.validate-eligibility': relationshipEligibilityJourney,
  'admin.tags.create': tagCreateJourney,
  'admin.treatments.add-clinictreatment-from-join': treatmentJoinClinicJourney,
  'admin.treatments.add-doctortreatment-from-join': treatmentJoinDoctorJourney,
  'admin.treatments.create': treatmentCreateJourney,
  'clinic.clinics.add-treatment-from-join': clinicTreatmentJoinJourney,
  'clinic.doctors.create-and-link-specialty': clinicDoctorSpecialtyJourney,
  'clinic.doctors.create-and-link-treatment': clinicDoctorTreatmentJourney,
} as const

export type KnownAdminJourneyId = keyof typeof adminJourneyRegistry

export const getAdminJourneyDefinition = <TJourneyId extends KnownAdminJourneyId>(journeyId: TJourneyId) =>
  adminJourneyRegistry[journeyId]

export const isKnownAdminJourneyId = (journeyId: string): journeyId is KnownAdminJourneyId =>
  journeyId in adminJourneyRegistry

export const findAdminJourneyDefinition = (
  journeyId: string,
): AdminJourneyDefinition<Record<string, unknown>> | undefined =>
  isKnownAdminJourneyId(journeyId)
    ? (adminJourneyRegistry[journeyId] as unknown as AdminJourneyDefinition<Record<string, unknown>>)
    : undefined

export const listAdminJourneys = () => Object.values(adminJourneyRegistry)
