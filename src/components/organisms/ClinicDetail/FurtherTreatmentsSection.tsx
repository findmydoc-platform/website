import * as React from 'react'
import { Stethoscope } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Card, CardContent } from '@/components/atoms/card'
import { UiLink } from '@/components/molecules/Link'
import { formatTreatmentPrice } from '@/features/clinicDetail/presentation'
import { getClinicProfileTranslator } from '@/features/clinicDetail/overviewCopy'
import type { UiCopyLocale } from '@/i18n/requestLocale'

import type { ClinicDetailTreatment } from '@/features/clinicDetail/contracts'

type FurtherTreatmentsSectionProps = {
  locale?: UiCopyLocale
  treatments: ClinicDetailTreatment[]
  visibleCount: number
  onShowMore: () => void
  onChooseTreatment: (treatmentId: string) => void
}

export function FurtherTreatmentsSection({
  locale = 'en',
  treatments,
  visibleCount,
  onShowMore,
  onChooseTreatment,
}: FurtherTreatmentsSectionProps) {
  const headingId = React.useId()
  const emptyStateId = React.useId()
  const t = getClinicProfileTranslator(locale)
  const visibleRows = React.useMemo(() => treatments.slice(0, visibleCount), [treatments, visibleCount])
  const canShowMore = visibleCount < treatments.length

  return (
    <section
      className="space-y-5"
      aria-labelledby={headingId}
      aria-describedby={visibleRows.length === 0 ? emptyStateId : undefined}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Heading id={headingId} as="h2" align="left" size="content-section" variant="navy">
          {t('treatments.further')}
        </Heading>
        <p className="text-sm text-supporting-foreground">
          {t('treatments.furtherCount', { count: treatments.length })}
        </p>
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
                {treatment.category ? (
                  <p className="mt-1 text-sm text-supporting-foreground">{treatment.category}</p>
                ) : null}
                <p className="mt-2 text-sm font-semibold text-primary">
                  {formatTreatmentPrice(treatment.priceFrom, locale)}
                </p>
              </div>

              <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:items-end">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => onChooseTreatment(treatment.id)}
                >
                  {t('treatments.choose')}
                </Button>
                {treatment.comparisonLink ? (
                  <UiLink
                    href={treatment.comparisonLink.href}
                    label={treatment.comparisonLink.label}
                    variant="content"
                    className="inline-flex min-h-9 items-center justify-center text-center text-sm font-semibold"
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
            <p id={emptyStateId} className="text-sm font-semibold text-secondary">
              {t('treatments.empty')}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        {canShowMore ? (
          <Button type="button" variant="secondary" className="w-full md:w-auto" onClick={onShowMore}>
            {t('treatments.showMore')}
          </Button>
        ) : null}
      </div>
    </section>
  )
}
