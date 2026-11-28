import * as React from 'react'
import { Clock, Phone, MessageCircle, ArrowRight } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { RatingSummary } from '@/components/molecules/RatingSummary'
import { SocialLink } from '@/components/molecules/SocialLink'
import { getClinicProfileTranslator } from '@/features/clinicDetail/overviewCopy'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { cn } from '@/utilities/ui'

import type { DoctorCardData } from './types'

export type DoctorCardProps = {
  data: DoctorCardData
  locale?: UiCopyLocale
  className?: string
  titleAs?: 'h2' | 'h3'
}

export function DoctorCard({ data, locale = 'en', className, titleAs = 'h3' }: DoctorCardProps) {
  const t = getClinicProfileTranslator(locale)
  const visibleQualifications = data.qualifications?.slice(0, 2) ?? []
  const remainingQualificationsCount = Math.max(0, (data.qualifications?.length ?? 0) - visibleQualifications.length)
  const visibleLanguages = data.languages?.slice(0, 3) ?? []
  const remainingLanguagesCount = Math.max(0, (data.languages?.length ?? 0) - visibleLanguages.length)

  return (
    <article className={cn('overflow-hidden rounded-2xl bg-card shadow-brand-soft', className)}>
      <div className="p-6 md:p-8">
        <div className="flex items-start gap-4 sm:gap-6">
          <div className="min-w-0 flex-1">
            <Heading
              align="left"
              as={titleAs}
              className="text-left text-2xl leading-tight font-semibold wrap-anywhere text-secondary md:text-3xl"
            >
              {data.name}
            </Heading>
            {data.subtitle ? <p className="mt-1 text-base text-secondary">{data.subtitle}</p> : null}
            {data.description ? (
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-secondary/60">{data.description}</p>
            ) : null}

            {visibleQualifications.length > 0 || typeof data.experienceYears === 'number' ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {visibleQualifications.map((qualification) => (
                  <span
                    key={qualification}
                    className="rounded-full border border-primary/20 bg-primary/6 px-2.5 py-1 text-xs font-medium text-secondary"
                  >
                    {qualification}
                  </span>
                ))}
                {remainingQualificationsCount > 0 ? (
                  <span className="rounded-full border border-primary/20 bg-primary/6 px-2.5 py-1 text-xs font-medium text-secondary">
                    {t('doctors.moreQualifications', { count: remainingQualificationsCount })}
                  </span>
                ) : null}
                {typeof data.experienceYears === 'number' ? (
                  <span className="rounded-full border border-primary/20 bg-background px-2.5 py-1 text-xs text-secondary/80">
                    {t('doctors.experience', { years: data.experienceYears })}
                  </span>
                ) : null}
              </div>
            ) : null}

            {visibleLanguages.length > 0 ? (
              <p className="mt-2 text-xs text-secondary/70">
                <span className="font-semibold text-secondary/80">{t('doctors.languages')}</span>{' '}
                {new Intl.ListFormat(locale).format(visibleLanguages)}
                {remainingLanguagesCount > 0 ? ` +${remainingLanguagesCount}` : ''}
              </p>
            ) : null}

            {data.socialLinks?.length ? (
              <div className="mt-4 flex items-center gap-2" aria-label={t('doctors.socialLinks')}>
                {data.socialLinks.map((link) => (
                  <SocialLink
                    key={`${link.kind}-${link.href}`}
                    href={link.href}
                    platform={link.kind}
                    aria-label={link.label}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 h-8" aria-hidden="true" />
            )}
          </div>

          {data.rating ? (
            <div className="shrink-0">
              <RatingSummary
                value={data.rating.value}
                count={data.rating.reviewCount}
                variant="stacked"
                locale={locale}
                ratingLabel={t('trust.ratingValue', {
                  rating: data.rating.value.toLocaleString(locale, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }),
                })}
                countLabel={t('trust.reviewCount', { count: data.rating.reviewCount })}
              />
            </div>
          ) : null}
        </div>
      </div>

      {data.actions ? (
        <nav aria-label={t('doctors.actions')} className="bg-primary px-4 py-5 md:px-8 md:py-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {data.actions.availability ? (
              <a
                href={data.actions.availability.href}
                onClick={data.actions.availability.onClick}
                className="inline-flex items-center gap-2.5 text-base text-primary-foreground/90 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <Clock className="size-5" aria-hidden="true" />
                <span>{data.actions.availability.label}</span>
              </a>
            ) : null}

            {data.actions.call ? (
              <a
                href={data.actions.call.href}
                onClick={data.actions.call.onClick}
                className="inline-flex items-center gap-2.5 text-base text-primary-foreground/90 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <Phone className="size-5" aria-hidden="true" />
                <span>{data.actions.call.label}</span>
              </a>
            ) : null}

            {data.actions.chat ? (
              <a
                href={data.actions.chat.href}
                onClick={data.actions.chat.onClick}
                className="inline-flex items-center gap-2.5 text-base text-primary-foreground/90 hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <MessageCircle className="size-5" aria-hidden="true" />
                <span>{data.actions.chat.label}</span>
              </a>
            ) : null}

            {data.actions.booking ? (
              <Button
                asChild
                variant="link"
                size="clear"
                className="ml-auto min-h-11 items-center text-base font-medium text-primary-foreground underline md:min-h-0"
              >
                <a
                  aria-label={data.actions.booking.label}
                  href={data.actions.booking.href}
                  onClick={data.actions.booking.onClick}
                >
                  {data.actions.booking.label}
                  <ArrowRight className="ml-2 size-5" aria-hidden="true" />
                </a>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </article>
  )
}
