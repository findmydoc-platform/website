import { getStoryImageSrc, storyClinicImages } from './assets'

export type LandingProcessStepImage = {
  src: string
  alt: string
}

export const landingProcessPlaceholderTitle = 'Our Process'

export const landingProcessPlaceholderSubtitle =
  'A transparent onboarding flow from profile setup to listed services and direct patient inquiries.'

export const landingProcessHomepageStepImages: ReadonlyArray<LandingProcessStepImage> = [
  {
    src: getStoryImageSrc(storyClinicImages.landing.processConsultation),
    alt: 'Clinic partner reaching out on the platform',
  },
  { src: getStoryImageSrc(storyClinicImages.landing.processProfile), alt: 'Clinic profile creation on findmydoc' },
  {
    src: getStoryImageSrc(storyClinicImages.landing.processVerification),
    alt: 'Clinic profile setup and listed service information',
  },
  {
    src: getStoryImageSrc(storyClinicImages.landing.processConnection),
    alt: 'Clinic team connecting directly with patients',
  },
]

export const landingProcessPartnerStepImages: ReadonlyArray<LandingProcessStepImage> = [
  {
    src: getStoryImageSrc(storyClinicImages.landing.processConsultation),
    alt: 'Clinic partner reaching out on the platform',
  },
  { src: getStoryImageSrc(storyClinicImages.landing.processProfile), alt: 'Clinic profile creation on findmydoc' },
  {
    src: getStoryImageSrc(storyClinicImages.landing.processVerification),
    alt: 'Clinic profile setup and listed service information',
  },
  {
    src: getStoryImageSrc(storyClinicImages.landing.processConnection),
    alt: 'Clinic team connecting directly with patients',
  },
]

export const landingProcessPlaceholderStepImages = landingProcessHomepageStepImages
