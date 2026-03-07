export type LandingProcessStepImage = {
  src: string
  alt: string
}

export const landingProcessPlaceholderTitle = 'Our Process'

export const landingProcessPlaceholderSubtitle =
  'Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.'

export const landingProcessHomepageStepImages: ReadonlyArray<LandingProcessStepImage> = [
  { src: '/images/landing/process-step-1-reach-out.png', alt: 'Clinic partner reaching out on the platform' },
  { src: '/images/landing/process-step-2-create-profile.png', alt: 'Clinic profile creation on findmydoc' },
  {
    src: '/images/landing/process-step-3-verification.png',
    alt: 'Clinic verification and quality review process',
  },
  {
    src: '/images/landing/home-process-step-4-connect-patients-primary.jpg',
    alt: 'Clinic team connecting directly with patients',
  },
]

export const landingProcessPartnerStepImages: ReadonlyArray<LandingProcessStepImage> = [
  {
    src: '/images/landing/partner-process-step-1-reach-out-alt.jpg',
    alt: 'Clinic partner reaching out on the platform',
  },
  { src: '/images/landing/process-step-2-create-profile.png', alt: 'Clinic profile creation on findmydoc' },
  {
    src: '/images/landing/partner-process-step-3-verification-alt-1.jpg',
    alt: 'Clinic verification and quality review process',
  },
  {
    src: '/images/landing/partner-process-step-4-connect-patients-alt4.png',
    alt: 'Clinic team connecting directly with patients',
  },
]

export const landingProcessPlaceholderStepImages = landingProcessHomepageStepImages
