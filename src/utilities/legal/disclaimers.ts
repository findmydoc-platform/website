export const DISCLAIMER_COPY = {
  platform: 'findmydoc is a comparison and contact platform. We do not provide medical advice.',
  blog: 'This article is for general information only. It is not medical advice.',
  clinicProfiles: 'Clinic profile details are provided by the clinic unless otherwise noted.',
  comparisonPages:
    'The information shown on comparison pages is for comparison purposes only. It is not a medical recommendation.',
} as const

export type DisclaimerCopyKey = keyof typeof DISCLAIMER_COPY
