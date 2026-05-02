import blogBackground from '../assets/blog-background.jpg'
import clinicConsultation from '../assets/clinic-consultation.jpg'
import clinicConsultationRoom from '../assets/clinic-consultation-room.jpg'
import clinicDentalSuite from '../assets/clinic-dental-suite.jpg'
import clinicDiagnosticsRoom from '../assets/clinic-diagnostics-room.jpg'
import clinicExteriorModern from '../assets/clinic-exterior-modern.jpg'
import clinicEyeExamRoom from '../assets/clinic-eye-exam-room.jpg'
import clinicHospitalExterior from '../assets/clinic-hospital-exterior.jpg'
import clinicHospitalCorridor from '../assets/clinic-hospital-corridor.jpg'
import clinicLaboratoryBench from '../assets/clinic-laboratory-bench.jpg'
import clinicLobbyReception from '../assets/clinic-lobby-reception.jpg'
import clinicRehabilitationGym from '../assets/clinic-rehabilitation-gym.jpg'
import clinicSurgicalPrepRoom from '../assets/clinic-surgical-prep-room.jpg'
import clinicTelemedicineWorkstation from '../assets/clinic-telemedicine-workstation.jpg'
import clinicWaitingArea from '../assets/clinic-waiting-area.jpg'
import clinicInterior from '../assets/content-clinic-interior.jpg'
import doctorPortrait from '../assets/doctor-portrait.jpg'
import featureBackground from '../assets/feature-background.jpg'
import medicalHero from '../assets/medical-hero.jpg'
import accountMenuAvatarGenerated from '../assets/account-menu-avatar-generated.png'
import postHeroExamRoom from '../assets/post-hero-exam-room.jpg'
import teamPortraitAnilGoekduman from '../assets/team-portrait-anil-goekduman.jpg'
import teamPortraitOezenGuenes from '../assets/team-portrait-oezen-guenes.jpg'
import teamPortraitSebastianSchuetze from '../assets/team-portrait-sebastian-schuetze.jpg'
import teamPortraitVolkanKablan from '../assets/team-portrait-volkan-kablan.jpg'
import teamPortraitYoussefAdlah from '../assets/team-portrait-youssef-adlah.jpg'
import testimonialPortraitAlexMorgan from '../assets/testimonial-portrait-alex-morgan.jpg'
import testimonialPortraitNinaFeld from '../assets/testimonial-portrait-nina-feld.jpg'
import testimonialPortraitRobertHayes from '../assets/testimonial-portrait-robert-hayes.jpg'

export const getStoryImageSrc = (image: string | { src: string }) => (typeof image === 'string' ? image : image.src)

export const storyClinicImages = {
  blog: {
    background: blogBackground,
    consultation: clinicConsultationRoom,
    diagnostics: clinicDiagnosticsRoom,
    postHeroExamRoom,
  },
  clinicDetail: {
    consultation: clinicConsultation,
    diagnostics: clinicDiagnosticsRoom,
    exterior: clinicExteriorModern,
    lab: clinicLaboratoryBench,
    rehabilitation: clinicRehabilitationGym,
    treatmentRoom: postHeroExamRoom,
  },
  landing: {
    blogBackground,
    featureBackground,
    hero: medicalHero,
    processConsultation: clinicConsultationRoom,
    processProfile: clinicLobbyReception,
    processVerification: clinicDiagnosticsRoom,
    processConnection: clinicTelemedicineWorkstation,
  },
  listing: {
    consultation: clinicConsultation,
    dental: clinicDentalSuite,
    diagnostics: clinicDiagnosticsRoom,
    exterior: clinicHospitalExterior,
    eyeCare: clinicEyeExamRoom,
    hospitalCorridor: clinicHospitalCorridor,
    interior: clinicInterior,
    lobby: clinicLobbyReception,
    rehabilitation: clinicRehabilitationGym,
    surgicalPrep: clinicSurgicalPrepRoom,
    telemedicine: clinicTelemedicineWorkstation,
    waitingArea: clinicWaitingArea,
  },
  shared: {
    exterior: clinicHospitalExterior,
    hero: medicalHero,
    interior: clinicInterior,
  },
} as const

export const storyPortraits = {
  accountMenuAvatar: accountMenuAvatarGenerated,
  doctor: doctorPortrait,
  team: {
    anil: teamPortraitAnilGoekduman,
    oezen: teamPortraitOezenGuenes,
    sebastian: teamPortraitSebastianSchuetze,
    volkan: teamPortraitVolkanKablan,
    youssef: teamPortraitYoussefAdlah,
  },
  testimonials: {
    alexMorgan: testimonialPortraitAlexMorgan,
    ninaFeld: testimonialPortraitNinaFeld,
    robertHayes: testimonialPortraitRobertHayes,
  },
} as const

export const storyClinicMedia = {
  consultation: {
    src: getStoryImageSrc(storyClinicImages.listing.consultation),
    alt: 'Doctor consulting with a patient',
  },
  dental: { src: getStoryImageSrc(storyClinicImages.listing.dental), alt: 'Modern dental treatment room' },
  diagnostics: { src: getStoryImageSrc(storyClinicImages.listing.diagnostics), alt: 'Modern diagnostics room' },
  exterior: { src: getStoryImageSrc(storyClinicImages.listing.exterior), alt: 'Modern clinic exterior' },
  hero: { src: getStoryImageSrc(storyClinicImages.listing.exterior), alt: 'Modern clinic exterior' },
  hospitalCorridor: {
    src: getStoryImageSrc(storyClinicImages.listing.hospitalCorridor),
    alt: 'Bright hospital corridor',
  },
  interior: { src: getStoryImageSrc(storyClinicImages.listing.interior), alt: 'Bright clinic interior' },
  lobby: { src: getStoryImageSrc(storyClinicImages.listing.lobby), alt: 'Modern clinic reception lobby' },
  rehabilitation: { src: getStoryImageSrc(storyClinicImages.listing.rehabilitation), alt: 'Clinic rehabilitation gym' },
  telemedicine: {
    src: getStoryImageSrc(storyClinicImages.listing.telemedicine),
    alt: 'Clinic telemedicine workstation',
  },
  treatmentRoom: { src: getStoryImageSrc(storyClinicImages.clinicDetail.treatmentRoom), alt: 'Modern exam room' },
  waitingArea: { src: getStoryImageSrc(storyClinicImages.listing.waitingArea), alt: 'Patient waiting area' },
} as const

export const storyAssetStoragePaths = {
  interior: 'src/stories/assets/content-clinic-interior.jpg',
  postHeroExamRoom: 'src/stories/assets/post-hero-exam-room.jpg',
} as const
