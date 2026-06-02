import { Eye, Sparkles, Stethoscope } from 'lucide-react'

import type { ClinicRegistrationCategoryIconKey, IconComponent } from './types'

function ToothIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path
        d="M7.3 3.4c1.1 0 2.1.5 3 1.1.9.6 1.5.6 2.4 0 .9-.6 1.9-1.1 3-1.1 2.4 0 4 1.9 4 4.4 0 1.8-.7 3.6-1.4 5.1-.7 1.7-1.1 3.4-1.4 5.1-.2 1.2-.9 2.6-2.1 2.6-1.1 0-1.4-1.4-1.7-2.9-.3-1.3-.6-2.7-1.1-2.7s-.8 1.4-1.1 2.7c-.3 1.5-.6 2.9-1.7 2.9-1.2 0-1.9-1.4-2.1-2.6-.3-1.7-.7-3.4-1.4-5.1-.7-1.5-1.4-3.3-1.4-5.1 0-2.5 1.6-4.4 4-4.4Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function HairRestorationIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M6 14.4c.3-4.8 2.7-7.2 6-7.2s5.7 2.4 6 7.2" strokeLinecap="round" />
      <path d="M8.3 13.1c.8-1.8 2-2.8 3.7-2.8s2.9 1 3.7 2.8" strokeLinecap="round" />
      <path d="M5.2 15.7c1.5 2.5 3.8 3.8 6.8 3.8s5.3-1.3 6.8-3.8" strokeLinecap="round" />
      <path d="M8.4 5.2c.5 1 .6 1.9.3 2.9" strokeLinecap="round" />
      <path d="M12 4.5c.4 1.1.4 2.1 0 3.2" strokeLinecap="round" />
      <path d="M15.6 5.2c-.5 1-.6 1.9-.3 2.9" strokeLinecap="round" />
    </svg>
  )
}

function PlasticSurgeryIcon({ className, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" {...props}>
      <path d="M8.6 4.5c.9 1.2 2 1.8 3.4 1.8s2.5-.6 3.4-1.8" strokeLinecap="round" />
      <path d="M7 8.6c1.3 1.2 3 1.8 5 1.8s3.7-.6 5-1.8" strokeLinecap="round" />
      <path d="M8.1 19.5c1.2-1.4 1.8-3.3 1.8-5.8" strokeLinecap="round" />
      <path d="M15.9 19.5c-1.2-1.4-1.8-3.3-1.8-5.8" strokeLinecap="round" />
      <path d="M5.5 12.2c1.5.9 3.7 1.4 6.5 1.4s5-.5 6.5-1.4" strokeLinecap="round" />
    </svg>
  )
}

export const categoryIconMap: Record<ClinicRegistrationCategoryIconKey, IconComponent> = {
  dental: ToothIcon,
  dermatology: Sparkles,
  'eye-care': Eye,
  fallback: Stethoscope,
  'hair-restoration': HairRestorationIcon,
  'plastic-surgery': PlasticSurgeryIcon,
}
