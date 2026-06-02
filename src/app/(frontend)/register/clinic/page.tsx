import { Heading } from '@/components/atoms/Heading'
import { ClinicRegistrationFunnel } from '@/components/templates/ClinicRegistrationFunnel'
import { getClinicRegistrationTreatmentCategories } from '@/utilities/clinicRegistration/treatmentCategories'
import configPromise from '@payload-config'
import { getPayload } from 'payload'

export default async function ClinicRegistrationPage() {
  const payload = await getPayload({ config: configPromise })
  const treatmentCategories = await getClinicRegistrationTreatmentCategories(payload)

  return (
    <section className="bg-site-canvas px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:px-6 sm:pt-6 sm:pb-[calc(env(safe-area-inset-bottom)+5rem)] md:px-8 md:pt-8 md:pb-16">
      <div className="mx-auto w-full max-w-[1184px]">
        <Heading align="left" as="h1" className="sr-only">
          Klinikregistrierung
        </Heading>
        <ClinicRegistrationFunnel treatmentCategories={treatmentCategories} />
      </div>
    </section>
  )
}
