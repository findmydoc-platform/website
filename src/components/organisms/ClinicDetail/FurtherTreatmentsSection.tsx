import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
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

              <Button type="button" variant="secondary" onClick={() => onChooseTreatment(treatment.id)}>
                Choose Treatment
              </Button>
            </article>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-secondary/60">No additional treatments available yet.</p>
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
