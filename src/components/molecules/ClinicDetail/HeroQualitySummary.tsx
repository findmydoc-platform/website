import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Card, CardContent } from '@/components/atoms/card'
import { VerificationBadge } from '@/components/atoms/verification-badge'
import { RatingSummary } from '@/components/molecules/RatingSummary'

import type { ClinicDetailTrust } from '@/components/templates/ClinicDetailConcepts/types'

type HeroQualitySummaryProps = {
  trust: ClinicDetailTrust
}

export function HeroQualitySummary({ trust }: HeroQualitySummaryProps) {
  const ratingValue = typeof trust.ratingValue === 'number' ? trust.ratingValue : undefined
  const reviewCount = typeof trust.reviewCount === 'number' ? trust.reviewCount : undefined
  const hasRating = typeof ratingValue === 'number' && typeof reviewCount === 'number' && reviewCount > 0
  const accreditationPreview = trust.accreditations.slice(0, 2)
  const languagesPreview = trust.languages.slice(0, 4)

  return (
    <Card className="max-w-[492px] rounded-[24px] border-0 shadow-brand-soft">
      <CardContent className="space-y-4 p-5">
        <Heading as="h2" align="left" size="h5" className="text-secondary">
          Quality Snapshot
        </Heading>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-primary/8 p-3 text-center">
            <p className="text-[11px] tracking-[0.15em] text-secondary/55 uppercase">Rating</p>
            <div className="mt-1 flex justify-center">
              {hasRating ? (
                <RatingSummary
                  value={ratingValue}
                  count={reviewCount}
                  variant="inline"
                  countFormat="reviews"
                  className="text-xs"
                />
              ) : (
                <p className="text-sm font-semibold text-secondary">No reviews yet</p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-primary/8 p-3 text-center">
            <p className="text-[11px] tracking-[0.15em] text-secondary/55 uppercase">Verification</p>
            <div className="mt-2 flex justify-center">
              <VerificationBadge variant={trust.verification} />
            </div>
          </div>

          <div className="rounded-xl bg-primary/8 p-3 text-center">
            <p className="text-[11px] tracking-[0.15em] text-secondary/55 uppercase">Accreditations</p>
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
              <p className="mt-1 text-sm font-semibold text-secondary">Not listed</p>
            )}
          </div>

          <div className="rounded-xl bg-primary/8 p-3 text-center">
            <p className="text-[11px] tracking-[0.15em] text-secondary/55 uppercase">Supported Languages</p>
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
              <p className="mt-1 text-sm font-semibold text-secondary">Not listed</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
