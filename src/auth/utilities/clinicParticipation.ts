import type { Clinic } from '@/payload-types'

// Null is the additive-migration compatibility state for clinics already authorized by the old model.
export const isClinicParticipationApproved = (clinic: Clinic): boolean =>
  !clinic.deletedAt &&
  clinic.status !== 'rejected' &&
  (clinic.participationStatus === 'approved' || (clinic.participationStatus == null && clinic.status === 'approved'))
