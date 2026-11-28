import { ClinicApplicationForm } from './ClinicApplicationForm.client'
import type { ClinicRegistrationTreatmentCategory } from '@/components/templates/ClinicRegistrationFunnel'
import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import type { ClinicApplicationCopy } from '@/features/uiCopy/clinicApplication'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { cn } from '@/utilities/ui'

type ClinicRegistrationLandingSectionProps = {
  ariaLabel?: string
  className?: string
  copy: ClinicApplicationCopy
  description: string
  id?: string
  locale: UiCopyLocale
  title: string
  treatmentCategories?: ClinicRegistrationTreatmentCategory[]
}

export function ClinicRegistrationLandingSection({
  ariaLabel,
  className,
  copy,
  description,
  id = 'clinic-registration',
  locale,
  title,
  treatmentCategories,
}: ClinicRegistrationLandingSectionProps) {
  return (
    <section
      aria-label={ariaLabel ?? copy.title}
      className={cn(
        'scroll-mt-[calc(var(--site-header-height)+1rem)] bg-site-canvas py-12 sm:py-16 md:py-20',
        className,
      )}
      id={id}
    >
      <Container>
        <div className="mx-auto w-full max-w-[1184px]">
          <div className="mb-12 sm:mb-14 md:mb-16">
            <SectionHeading
              title={title}
              description={description}
              size="section"
              align="center"
              titleClassName="font-semibold"
            />
          </div>
          <ClinicApplicationForm
            copy={copy}
            locale={locale}
            treatmentCategories={treatmentCategories}
            variant="landing"
          />
        </div>
      </Container>
    </section>
  )
}
