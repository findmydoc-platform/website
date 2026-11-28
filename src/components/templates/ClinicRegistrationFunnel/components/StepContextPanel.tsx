import { Mail, MapPin, Phone } from 'lucide-react'

import type { ClinicApplicationCopy } from '@/features/uiCopy/clinicApplication'
import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'
import type { ClinicRegistrationFunnelVariant, ClinicRegistrationReviewSummary, ClinicRegistrationStep } from '../types'
import { ReviewSummary } from './ReviewSummary'
import { SupportRow } from './SupportRow'

export function StepContextPanel({
  className,
  copy,
  reviewSummary,
  selectedCategoryLabels,
  step,
  transitionClassName,
  variant = 'default',
}: {
  className?: string
  copy: ClinicApplicationCopy['context']
  reviewSummary: ClinicRegistrationReviewSummary
  selectedCategoryLabels: string[]
  step: ClinicRegistrationStep
  transitionClassName?: string
  variant?: ClinicRegistrationFunnelVariant
}) {
  const isLanding = variant === 'landing'
  const panelClassName = isLanding
    ? 'relative isolate overflow-hidden border-b border-slate-200/80 bg-white px-6 py-8 text-card-foreground sm:px-8 sm:py-9 lg:min-h-full lg:border-r lg:border-b-0 lg:px-9 lg:py-10'
    : 'relative isolate overflow-hidden bg-secondary px-7 py-8 text-secondary-foreground sm:px-10 sm:py-11 lg:min-h-full lg:px-12 lg:py-12'
  const headingClassName = isLanding
    ? 'text-[21px] leading-tight break-words text-foreground sm:text-[24px]'
    : 'text-[22px] leading-tight break-words text-white sm:text-[26px]'
  const paragraphClassName = isLanding
    ? 'text-base leading-7 text-slate-700'
    : 'text-base leading-relaxed text-white/85'
  const panelBackground = (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 z-0 bg-[url('/images/clinic-registration-funnel-panel.webp')] bg-cover bg-center",
          !isLanding && 'saturate-[0.72]',
        )}
      />
      <div aria-hidden="true" className={cn('absolute inset-0 z-0', isLanding ? 'bg-white/70' : 'bg-secondary/86')} />
    </>
  )

  if (step === 4) {
    return (
      <aside
        className={cn(
          'flex min-h-[300px] w-full min-w-0 flex-col',
          panelClassName,
          isLanding && 'lg:min-h-full',
          transitionClassName,
          className,
          copy,
        )}
      >
        {panelBackground}
        <div className="relative z-10 flex min-h-full flex-col">
          <Heading align="left" as="h2" className={headingClassName} size="h4">
            {copy.summary.title}
          </Heading>
          <p
            className={cn(
              'mt-4 max-w-[330px]',
              isLanding ? paragraphClassName : 'text-[17px] leading-relaxed text-white/85',
            )}
          >
            {copy.summary.description}
          </p>
          <ReviewSummary
            copy={copy.summary}
            reviewSummary={reviewSummary}
            selectedCategoryLabels={selectedCategoryLabels}
            variant={variant}
          />
        </div>
      </aside>
    )
  }

  if (step === 3) {
    return (
      <aside
        className={cn(
          'flex min-h-[320px] w-full min-w-0 flex-col justify-center',
          panelClassName,
          transitionClassName,
          className,
          copy,
        )}
      >
        {panelBackground}
        <div className="relative z-10 flex min-h-full flex-col justify-center">
          <Heading align="left" as="h2" className={headingClassName} size="h4">
            {copy.contact.title}
          </Heading>
          {isLanding ? null : (
            <p className={cn('mt-4 max-w-[360px]', paragraphClassName)}>{copy.contact.description}</p>
          )}
          <div
            className={cn(
              'grid border-t',
              isLanding
                ? 'mt-8 gap-6 border-slate-200/80 pt-7 lg:mt-auto'
                : 'mt-10 gap-7 border-white/15 pt-8 lg:mt-auto',
            )}
          >
            <SupportRow icon={Phone} label={copy.contact.phone} value="+49 (0) 30 1234 5678" variant={variant} />
            <SupportRow icon={Mail} label={copy.contact.email} value="support@findmydoc.de" variant={variant} />
            <SupportRow
              icon={MapPin}
              label={copy.contact.office}
              value={`Friedrichstrasse 100, 10117 Berlin, ${copy.contact.country}`}
              variant={variant}
            />
          </div>
        </div>
      </aside>
    )
  }

  if (step === 2) {
    return (
      <aside
        className={cn(
          'flex min-h-[300px] w-full min-w-0 flex-col justify-center',
          panelClassName,
          transitionClassName,
          className,
          copy,
        )}
      >
        {panelBackground}
        <div className="relative z-10 flex min-h-full flex-col justify-center">
          <Heading align="left" as="h2" className={headingClassName} size="h4">
            {copy.specialties.title}
          </Heading>
          <p
            className={cn(
              'mt-4 max-w-[360px]',
              isLanding ? paragraphClassName : 'text-base leading-relaxed text-white/90',
            )}
          >
            {copy.specialties.description}
          </p>
        </div>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        'flex min-h-[310px] w-full min-w-0 flex-col justify-center',
        panelClassName,
        transitionClassName,
        className,
        copy,
      )}
    >
      {panelBackground}
      <div className="relative z-10 flex min-h-full flex-col justify-center">
        <Heading align="left" as="h2" className={cn('max-w-[385px]', headingClassName)} size="h4">
          {copy.details.title}
        </Heading>
        <p
          className={cn(
            'max-w-[388px]',
            isLanding ? cn('mt-5', paragraphClassName) : 'mt-7 text-lg leading-relaxed text-white/90',
          )}
        >
          {copy.details.description}
        </p>
      </div>
    </aside>
  )
}
