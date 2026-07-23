'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'

import { LifecycleStatusPanel } from '@/app/(payload)/components/LifecycleStatusPanel'
import {
  clinicApplicationProvisioningInputFields,
  getClinicApplicationLifecyclePresentation,
} from '@/collections/clinicApplications/provisioningLifecycle'
import type { ClinicApplication } from '@/payload-types'

export function ClinicApplicationLifecyclePanel() {
  const { initialData } = useDocumentInfo()
  const formState = useFormFields(([fields]) => ({
    provisioningInputs: clinicApplicationProvisioningInputFields.map((field) => fields[field]?.value),
    status: fields.status?.value,
  }))
  const persistedData = (initialData ?? {}) as Partial<ClinicApplication>
  const currentData = {
    ...persistedData,
    ...Object.fromEntries(
      clinicApplicationProvisioningInputFields.map((field, index) => [field, formState.provisioningInputs[index]]),
    ),
    status: formState.status,
  } as Partial<ClinicApplication>
  const presentation = getClinicApplicationLifecyclePresentation({
    currentData,
    persistedData,
  })

  return <LifecycleStatusPanel {...presentation} title="Provisioning lifecycle" />
}
