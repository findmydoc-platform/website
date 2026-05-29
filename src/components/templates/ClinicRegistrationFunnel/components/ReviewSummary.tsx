import { BriefcaseBusiness, Building2, UserRound } from 'lucide-react'

import type { ClinicRegistrationReviewSummary } from '../types'
import { SummaryGroup } from './SummaryGroup'

export function ReviewSummary({
  reviewSummary,
  selectedCategoryLabels,
}: {
  reviewSummary: ClinicRegistrationReviewSummary
  selectedCategoryLabels: string[]
}) {
  return (
    <div className="mt-12 grid gap-10">
      <SummaryGroup icon={Building2} label="Klinik-Details">
        <strong className="block text-base font-medium [overflow-wrap:anywhere] break-words text-white">
          {reviewSummary.clinicName}
        </strong>
        <span className="block text-xs leading-5 [overflow-wrap:anywhere] break-words text-white/70">
          {reviewSummary.clinicWebsite ?? reviewSummary.clinicAddress}
        </span>
      </SummaryGroup>
      <SummaryGroup icon={BriefcaseBusiness} label="Schwerpunkte">
        <div className="mt-2 flex flex-wrap gap-2">
          {(selectedCategoryLabels.length > 0 ? selectedCategoryLabels : ['Noch nicht ausgewählt']).map((label) => (
            <span className="rounded-full bg-primary/30 px-2.5 py-0.5 text-xs break-words text-white" key={label}>
              {label}
            </span>
          ))}
        </div>
      </SummaryGroup>
      <SummaryGroup icon={UserRound} label="Kontaktperson">
        <strong className="block text-base font-medium [overflow-wrap:anywhere] break-words text-white">
          {reviewSummary.contactName}
        </strong>
        <span className="block text-xs leading-5 [overflow-wrap:anywhere] break-words text-white/70">
          {reviewSummary.contactRole}
          <br />
          {reviewSummary.contactEmail}
        </span>
      </SummaryGroup>
    </div>
  )
}
