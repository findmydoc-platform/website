import type { TrustAtomTone } from '@/components/atoms/TrustAtom'
import type { LandingHeroAction } from '@/components/organisms/Heroes/LandingHero'

export const signalItems: Array<{ label: string; title: string; tone: TrustAtomTone }> = [
  {
    label: 'Gather',
    title: 'Scattered information',
    tone: 'primary',
  },
  {
    label: 'Compare',
    title: 'Comparison context',
    tone: 'accent',
  },
  {
    label: 'Clarify',
    title: 'Decision boundary',
    tone: 'secondary',
  },
]

export const accountabilityLabels = [
  'Partner standards',
  'Clinic communication',
  'Comparison product',
  'Legal clarity',
  'Platform reliability',
]

export const boundaryItems: Array<{ label: string; title: string }> = [
  { label: 'Owner', title: 'Clinic responsibility' },
  { label: 'Evidence', title: 'Reviewed signals' },
  { label: 'Scope', title: 'Medical-advice separation' },
]

export const atomMotion = [
  { floatDelay: '0s', floatDuration: '4.6s', floatLift: '-6px', floatDrift: '1px' },
  { floatDelay: '-1.35s', floatDuration: '5.2s', floatLift: '-4px', floatDrift: '-1px' },
  { floatDelay: '-2.15s', floatDuration: '4.9s', floatLift: '-5px', floatDrift: '0.5px' },
] as const

export const heroActions: LandingHeroAction[] = [
  { href: '/listing-comparison', label: 'Compare clinics', appearance: 'accent' },
  { href: '/partners/clinics', label: 'For clinics', appearance: 'secondary' },
]

export const closingActions = [
  { href: '/listing-comparison', label: 'Compare clinics', appearance: 'accent' },
  { href: '/partners/clinics', label: 'Register your clinic', appearance: 'secondary' },
] as const
