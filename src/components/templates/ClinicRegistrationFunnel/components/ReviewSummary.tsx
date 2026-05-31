import { BriefcaseBusiness, Building2, UserRound } from 'lucide-react'

import { cn } from '@/utilities/ui'
import type { ClinicRegistrationFunnelVariant, ClinicRegistrationReviewSummary } from '../types'
import { SummaryGroup } from './SummaryGroup'

export function ReviewSummary({
  reviewSummary,
  selectedCategoryLabels,
  variant = 'default',
}: {
  reviewSummary: ClinicRegistrationReviewSummary
  selectedCategoryLabels: string[]
  variant?: ClinicRegistrationFunnelVariant
}) {
  const isLanding = variant === 'landing'

  return (
    <div className={cn('grid', isLanding ? 'mt-10 gap-8' : 'mt-12 gap-10')}>
      <SummaryGroup icon={Building2} label="Clinic details" variant={variant}>
        <strong className={cn('block text-base font-medium [overflow-wrap:anywhere] break-words text-white')}>
          {reviewSummary.clinicName}
        </strong>
        <span
          className={cn(
            'block text-xs leading-5 [overflow-wrap:anywhere] break-words',
            isLanding ? 'text-white/72' : 'text-white/70',
          )}
        >
          {reviewSummary.clinicWebsite ?? reviewSummary.clinicAddress}
        </span>
      </SummaryGroup>
      <SummaryGroup icon={BriefcaseBusiness} label="Departments" variant={variant}>
        <div className="mt-2 flex flex-wrap gap-2">
          {(selectedCategoryLabels.length > 0 ? selectedCategoryLabels : ['Not selected yet']).map((label) => (
            <span
              className={cn(
                'rounded-full px-2.5 py-0.5 text-xs break-words',
                isLanding ? 'border border-accent/25 bg-accent/15 text-accent' : 'bg-primary/30 text-white',
              )}
              key={label}
            >
              {label}
            </span>
          ))}
        </div>
      </SummaryGroup>
      <SummaryGroup icon={UserRound} label="Contact person" variant={variant}>
        <strong className={cn('block text-base font-medium [overflow-wrap:anywhere] break-words text-white')}>
          {reviewSummary.contactName}
        </strong>
        <span
          className={cn(
            'block text-xs leading-5 [overflow-wrap:anywhere] break-words',
            isLanding ? 'text-white/72' : 'text-white/70',
          )}
        >
          {reviewSummary.contactRole}
          <br />
          {reviewSummary.contactEmail}
        </span>
      </SummaryGroup>
    </div>
  )
}
