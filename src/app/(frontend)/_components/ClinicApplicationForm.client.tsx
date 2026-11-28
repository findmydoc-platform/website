'use client'

import { submitClinicRegistration } from '@/auth/utilities/clinicRegistrationSubmission'
import {
  ClinicRegistrationFunnel,
  type ClinicRegistrationFunnelProps,
} from '@/components/templates/ClinicRegistrationFunnel'

export function ClinicApplicationForm(props: Omit<ClinicRegistrationFunnelProps, 'onSubmit'>) {
  return <ClinicRegistrationFunnel {...props} onSubmit={submitClinicRegistration} />
}
