import { createTestConfig } from '../shared/createTestConfig'
import { Accreditation } from '@/collections/Accreditation'
import { AuthActions } from '@/collections/AuthActions'
import { Categories } from '@/collections/Categories'
import { Cities } from '@/collections/Cities'
import { ClinicApplications } from '@/collections/ClinicApplications'
import { ClinicGalleryEntries } from '@/collections/ClinicGalleryEntries'
import { ClinicGalleryMedia } from '@/collections/ClinicGalleryMedia'
import { ClinicMedia } from '@/collections/ClinicMedia'
import { ClinicStaff } from '@/collections/ClinicStaff'
import { Clinics } from '@/collections/Clinics'
import { ClinicTreatments } from '@/collections/ClinicTreatments'
import { Countries } from '@/collections/Countries'
import { DoctorMedia } from '@/collections/DoctorMedia'
import { Doctors } from '@/collections/Doctors'
import { DoctorSpecialties } from '@/collections/DoctorSpecialties'
import { DoctorTreatments } from '@/collections/DoctorTreatments'
import { FavoriteClinics } from '@/collections/FavoriteClinics'
import { InquiryAttachments } from '@/collections/InquiryAttachments'
import { InquiryConversations } from '@/collections/InquiryConversations'
import { InquiryMessages } from '@/collections/InquiryMessages'
import { MedicalSpecialties } from '@/collections/MedicalSpecialties'
import { Pages } from '@/collections/Pages'
import { PatientClinicInquiries } from '@/collections/PatientClinicInquiries'
import { Patients } from '@/collections/Patients'
import { PlatformContentMedia } from '@/collections/PlatformContentMedia'
import { PlatformStaff } from '@/collections/PlatformStaff'
import { Posts } from '@/collections/Posts'
import { RecoveryRequestEvents } from '@/collections/RecoveryRequestEvents'
import { ReviewAppeals } from '@/collections/ReviewAppeals'
import { ReviewResponses } from '@/collections/ReviewResponses'
import { Reviews } from '@/collections/Reviews'
import { Tags } from '@/collections/Tags'
import { TransactionalEmailEvents } from '@/collections/TransactionalEmailEvents'
import { TransactionalEmailOutbox } from '@/collections/TransactionalEmailOutbox'
import { TransactionalEmailSuppressions } from '@/collections/TransactionalEmailSuppressions'
import { Treatments } from '@/collections/Treatments'
import { UserProfileMedia } from '@/collections/UserProfileMedia'

export default createTestConfig([
  Accreditation,
  AuthActions,
  Categories,
  Cities,
  ClinicApplications,
  ClinicGalleryEntries,
  ClinicGalleryMedia,
  ClinicMedia,
  ClinicStaff,
  Clinics,
  ClinicTreatments,
  Countries,
  DoctorMedia,
  Doctors,
  DoctorSpecialties,
  DoctorTreatments,
  FavoriteClinics,
  InquiryAttachments,
  InquiryConversations,
  InquiryMessages,
  MedicalSpecialties,
  Pages,
  PatientClinicInquiries,
  Patients,
  PlatformContentMedia,
  PlatformStaff,
  Posts,
  RecoveryRequestEvents,
  ReviewAppeals,
  ReviewResponses,
  Reviews,
  Tags,
  TransactionalEmailEvents,
  TransactionalEmailOutbox,
  TransactionalEmailSuppressions,
  Treatments,
  UserProfileMedia,
])
