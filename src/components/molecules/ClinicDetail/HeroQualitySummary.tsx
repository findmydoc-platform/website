import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Card, CardContent } from '@/components/atoms/card'
import { VerificationBadge } from '@/components/atoms/verification-badge'
import { RatingSummary } from '@/components/molecules/RatingSummary'
import { cn } from '@/utilities/ui'
import { getClinicProfileTranslator } from '@/features/clinicDetail/overviewCopy'
import type { UiCopyLocale } from '@/i18n/requestLocale'

import type { ClinicDetailTrust } from '@/features/clinicDetail/contracts'

type HeroQualitySummaryProps = {
  trust: ClinicDetailTrust
  className?: string
  locale?: UiCopyLocale
}

export function HeroQualitySummary({ trust, className, locale = 'en' }: HeroQualitySummaryProps) {
  const t = getClinicProfileTranslator(locale)
  const ratingValue = trust.ratingValue
  const reviewCount = trust.reviewCount
  const hasRating = ratingValue !== null && reviewCount > 0
  const accreditationPreview = trust.accreditations.slice(0, 2)
  const languagesPreview = trust.languages.slice(0, 4)

  return (
    <Card className={cn('w-full rounded-[24px] border-0 shadow-brand-soft', className)}>
      <CardContent className="space-y-4 p-5">
        <Heading as="h2" align="left" size="h5" className="text-secondary">
          {t('trust.heading')}
        </Heading>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-primary/8 p-3 text-center">
            <p className="text-[11px] tracking-[0.15em] text-secondary/55 uppercase">{t('trust.rating')}</p>
            <div className="mt-1 flex justify-center">
              {hasRating ? (
                <RatingSummary
                  value={ratingValue}
                  count={reviewCount}
                  variant="inline"
                  locale={locale}
                  countLabel={t('trust.reviewCount', { count: reviewCount })}
                  ratingLabel={t('trust.ratingValue', {
                    rating: ratingValue.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
                  })}
                  className="text-xs"
                />
              ) : (
                <p className="text-sm font-semibold text-secondary">{t('trust.noReviews')}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-primary/8 p-3 text-center">
            <p className="text-[11px] tracking-[0.15em] text-secondary/55 uppercase">{t('trust.verification')}</p>
            <div className="mt-2 flex justify-center">
              <VerificationBadge variant={trust.verification} label={t(`trust.${trust.verification}`)} />
            </div>
          </div>

          <div className="rounded-xl bg-primary/8 p-3 text-center">
            <p className="text-[11px] tracking-[0.15em] text-secondary/55 uppercase">{t('trust.accreditations')}</p>
            {accreditationPreview.length > 0 ? (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {accreditationPreview.map((accreditation) => (
                  <span
                    key={accreditation}
                    className="rounded-full border border-primary/20 bg-background px-2.5 py-1 text-xs font-medium text-secondary"
                  >
                    {accreditation}
                  </span>
                ))}
                {trust.accreditations.length > accreditationPreview.length ? (
                  <span className="rounded-full border border-primary/20 bg-background px-2.5 py-1 text-xs text-secondary/70">
                    +{trust.accreditations.length - accreditationPreview.length}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-sm font-semibold text-secondary">{t('trust.notListed')}</p>
            )}
          </div>

          <div className="rounded-xl bg-primary/8 p-3 text-center">
            <p className="text-[11px] tracking-[0.15em] text-secondary/55 uppercase">{t('trust.languages')}</p>
            {languagesPreview.length > 0 ? (
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {languagesPreview.map((language) => (
                  <span
                    key={language}
                    className="rounded-full border border-primary/20 bg-background px-2.5 py-1 text-xs font-medium text-secondary"
                  >
                    {language}
                  </span>
                ))}
                {trust.languages.length > languagesPreview.length ? (
                  <span className="rounded-full border border-primary/20 bg-background px-2.5 py-1 text-xs text-secondary/70">
                    +{trust.languages.length - languagesPreview.length}
                  </span>
                ) : null}
              </div>
            ) : (
              <p className="mt-1 text-sm font-semibold text-secondary">{t('trust.notListed')}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
