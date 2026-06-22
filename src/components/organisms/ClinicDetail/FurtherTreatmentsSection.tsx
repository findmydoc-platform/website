import * as React from 'react'
import { Stethoscope } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { UiLink } from '@/components/molecules/Link'
import { formatUsd } from '@/components/templates/ClinicDetailConcepts/shared'

import type { ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'

type FurtherTreatmentsSectionProps = {
  treatments: ClinicDetailTreatment[]
  visibleCount: number
  onShowMore: () => void
  onChooseTreatment: (treatmentId: string) => void
}

export function FurtherTreatmentsSection({
  treatments,
  visibleCount,
  onShowMore,
  onChooseTreatment,
}: FurtherTreatmentsSectionProps) {
  const visibleRows = React.useMemo(() => treatments.slice(0, visibleCount), [treatments, visibleCount])
  const canShowMore = visibleCount < treatments.length

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Heading as="h2" align="left" size="h4" className="text-secondary">
          Further Treatments
        </Heading>
        <p className="text-sm text-secondary/60">{treatments.length} additional treatments</p>
      </div>

      {visibleRows.length > 0 ? (
        <div className="space-y-3">
          {visibleRows.map((treatment) => (
            <article
              key={treatment.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-background px-4 py-4 transition-colors"
            >
              <div className="min-w-0">
                <p className="text-base font-semibold text-secondary">{treatment.name}</p>
                <p className="mt-1 text-sm text-secondary/60">{treatment.category ?? 'General treatment'}</p>
                <p className="mt-2 text-sm font-semibold text-primary">
                  {typeof treatment.priceFromUsd === 'number'
                    ? `From ${formatUsd(treatment.priceFromUsd)}`
                    : 'Price on request'}
                </p>
              </div>

              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => onChooseTreatment(treatment.id)}
                >
                  Choose Treatment
                </Button>
                {treatment.comparisonLink ? (
                  <UiLink
                    href={treatment.comparisonLink.href}
                    label={treatment.comparisonLink.label}
                    className="inline-flex min-h-9 items-center justify-center text-center text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Card className="border-primary/20 bg-background">
          <CardContent className="flex items-start gap-3 p-5 md:p-6">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Stethoscope className="size-4 text-primary" aria-hidden={true} />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-secondary">No additional treatments available yet.</p>
              <p className="text-sm text-secondary/60">
                You can still submit a contact request and describe the treatment you are looking for.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {canShowMore ? (
          <Button type="button" variant="secondary" className="w-full md:w-auto" onClick={onShowMore}>
            Show more treatments
          </Button>
        ) : null}
      </div>
    </section>
  )
}
