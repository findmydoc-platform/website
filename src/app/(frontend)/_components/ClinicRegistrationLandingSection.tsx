import { ClinicRegistrationFunnel } from '@/components/templates/ClinicRegistrationFunnel'
import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

type ClinicRegistrationLandingSectionProps = {
  ariaLabel?: string
  className?: string
  id?: string
}

export function ClinicRegistrationLandingSection({
  ariaLabel = 'Klinikregistrierung',
  className,
  id = 'clinic-registration',
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
          <ClinicRegistrationFunnel />
        </div>
      </Container>
    </section>
  )
}
