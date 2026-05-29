import { ClinicRegistrationFunnel } from '@/components/templates/ClinicRegistrationFunnel'
import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { cn } from '@/utilities/ui'

type ClinicRegistrationLandingSectionProps = {
  className?: string
  description?: string
  headingAs?: 'h1' | 'h2' | 'h3'
  id?: string
  title?: string
}

const defaultTitle = 'Klinikregistrierung'
const defaultDescription =
  'Tragen Sie Ihre Klinik in wenigen Schritten ein. Wir prüfen die Angaben und melden uns, sobald die Registrierung eingeordnet ist.'

export function ClinicRegistrationLandingSection({
  className,
  description = defaultDescription,
  headingAs = 'h2',
  id = 'clinic-registration',
  title = defaultTitle,
}: ClinicRegistrationLandingSectionProps) {
  const titleId = `${id}-heading`

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'scroll-mt-[calc(var(--site-header-height)+1rem)] bg-site-canvas py-16 sm:py-20 md:py-24',
        className,
      )}
      id={id}
    >
      <Container>
        <div className="mx-auto flex w-full max-w-[1184px] flex-col gap-8 sm:gap-10">
          <SectionHeading
            align="center"
            description={description}
            descriptionClassName="max-w-3xl"
            headingAs={headingAs}
            size="section"
            title={title}
            titleId={titleId}
          />
          <ClinicRegistrationFunnel />
        </div>
      </Container>
    </section>
  )
}
