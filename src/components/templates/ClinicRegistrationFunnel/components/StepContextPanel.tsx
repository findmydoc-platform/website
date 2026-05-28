import { Mail, MapPin, Phone } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { cn } from '@/utilities/ui'
import type { ClinicRegistrationReviewSummary, ClinicRegistrationStep } from '../types'
import { ReviewSummary } from './ReviewSummary'
import { SupportRow } from './SupportRow'

export function StepContextPanel({
  className,
  reviewSummary,
  selectedCategoryLabels,
  step,
  transitionClassName,
}: {
  className?: string
  reviewSummary: ClinicRegistrationReviewSummary
  selectedCategoryLabels: string[]
  step: ClinicRegistrationStep
  transitionClassName?: string
}) {
  if (step === 4) {
    return (
      <aside
        className={cn(
          'flex min-h-[300px] w-full min-w-0 flex-col bg-secondary px-7 py-8 text-secondary-foreground sm:px-10 sm:py-11 lg:min-h-full lg:px-12 lg:py-12',
          transitionClassName,
          className,
        )}
      >
        <Heading
          align="left"
          as="h2"
          className="text-[22px] leading-tight break-words text-white sm:text-[26px]"
          size="h4"
        >
          Überprüfung
        </Heading>
        <p className="mt-4 max-w-[330px] text-[17px] leading-relaxed text-white/85">
          Zusammenfassung Ihrer Angaben vor dem Abschluss.
        </p>
        <ReviewSummary reviewSummary={reviewSummary} selectedCategoryLabels={selectedCategoryLabels} />
      </aside>
    )
  }

  if (step === 3) {
    return (
      <aside
        className={cn(
          'flex min-h-[320px] w-full min-w-0 flex-col justify-center bg-secondary px-7 py-8 text-secondary-foreground sm:px-10 sm:py-11 lg:min-h-full lg:px-12 lg:py-12',
          transitionClassName,
          className,
        )}
      >
        <Heading
          align="left"
          as="h2"
          className="text-[22px] leading-tight break-words text-white sm:text-[26px]"
          size="h4"
        >
          Kontaktinformationen
        </Heading>
        <p className="mt-4 max-w-[360px] text-base leading-relaxed text-white/85">
          Wir melden uns bei der richtigen Kontaktperson, sobald die Registrierung geprüft wurde.
        </p>
        <div className="mt-10 grid gap-7 border-t border-white/15 pt-8 lg:mt-auto">
          <SupportRow icon={Phone} label="Telefon" value="+49 (0) 30 1234 5678" />
          <SupportRow icon={Mail} label="E-Mail" value="support@findmydoc.de" />
          <SupportRow icon={MapPin} label="Zentrale" value="Friedrichstraße 100 10117 Berlin, Deutschland" />
        </div>
      </aside>
    )
  }

  if (step === 2) {
    return (
      <aside
        className={cn(
          'flex min-h-[300px] w-full min-w-0 flex-col justify-center bg-secondary px-7 py-8 text-secondary-foreground sm:px-10 sm:py-11 lg:min-h-full lg:px-12 lg:py-12',
          transitionClassName,
          className,
        )}
      >
        <Heading
          align="left"
          as="h2"
          className="text-[22px] leading-tight break-words text-white sm:text-[26px]"
          size="h4"
        >
          Schwerpunkte der Klinik
        </Heading>
        <p className="mt-4 max-w-[360px] text-base leading-relaxed text-white/90">
          Wählen Sie die Behandlungskategorien, mit denen internationale Patientinnen und Patienten Ihre Klinik finden
          sollen.
        </p>
      </aside>
    )
  }

  return (
    <aside
      className={cn(
        'flex min-h-[310px] w-full min-w-0 flex-col justify-center bg-secondary px-7 py-8 text-secondary-foreground sm:px-10 sm:py-11 lg:min-h-full lg:px-12 lg:py-12',
        transitionClassName,
        className,
      )}
    >
      <Heading
        align="left"
        as="h2"
        className="max-w-[385px] text-[22px] leading-tight break-words text-white sm:text-[26px]"
        size="h4"
      >
        Klinik international sichtbar machen
      </Heading>
      <p className="mt-7 max-w-[388px] text-lg leading-relaxed text-white/90">
        Registrieren Sie Ihre Klinik für die Prüfung und den Aufbau Ihrer Präsenz auf findmydoc.
      </p>
    </aside>
  )
}
