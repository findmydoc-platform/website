import { ClinicRegistrationFunnel } from '@/components/templates/ClinicRegistrationFunnel'
import type { ClinicRegistrationTreatmentCategory } from '@/components/templates/ClinicRegistrationFunnel'
import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { cn } from '@/utilities/ui'

type ClinicRegistrationLandingSectionProps = {
  ariaLabel?: string
  className?: string
  id?: string
  treatmentCategories?: ClinicRegistrationTreatmentCategory[]
}

export function ClinicRegistrationLandingSection({
  ariaLabel = 'Start partner inquiry',
  className,
  id = 'clinic-registration',
  treatmentCategories,
}: ClinicRegistrationLandingSectionProps) {
  return (
    <section
      aria-label={ariaLabel}
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
              title="Ready for verified visibility?"
              description="Share the key details. We review your request personally and follow up with the next steps."
              size="section"
              align="center"
              titleClassName="font-semibold"
            />
          </div>
          <ClinicRegistrationFunnel treatmentCategories={treatmentCategories} variant="landing" />
        </div>
      </Container>
    </section>
  )
}
