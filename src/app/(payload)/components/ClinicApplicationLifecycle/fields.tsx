import { SelectField } from '@payloadcms/ui'
import type { PayloadRequest, SelectFieldServerProps, UIFieldServerProps } from 'payload'
import { cache } from 'react'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
import { clinicApplicationProvisioningInputFields } from '@/collections/clinicApplications/provisioningLifecycle'
import type { ClinicApplication } from '@/payload-types'
import { readOnboardingStatus } from '@/features/clinicOnboarding/stagedApplication'
import { ClinicApplicationLifecyclePanel } from './index'
import { OnboardingDecision } from './OnboardingDecision'

const readStagedApplication = cache(async (req: PayloadRequest, id?: number | string) => {
  if (id === undefined || !(await isPlatformStaff({ req }))) return null
  const application = await req.payload.findByID({
    collection: 'clinicApplications',
    id,
    depth: 0,
    disableErrors: true,
    overrideAccess: true,
    req,
  })
  return application?.mcpOnboardingStaffMode ? application : null
})

export async function ClinicApplicationStatusField({ clientField, id, path, readOnly, req }: SelectFieldServerProps) {
  const usesMcpOnboarding = Boolean(await readStagedApplication(req, id))
  return <SelectField field={clientField} path={path} readOnly={readOnly || usesMcpOnboarding} />
}

function reviewValues(application: Partial<ClinicApplication>) {
  const relationId = (value: number | { id: number } | null | undefined) =>
    typeof value === 'object' ? (value?.id ?? null) : (value ?? null)

  return JSON.stringify([
    application.id,
    application.updatedAt,
    application.status,
    application.provisioningStatus ?? 'not_started',
    application.provisioningErrorCode ?? null,
    relationId(application.linkedRecords?.clinic),
    relationId(application.linkedRecords?.clinicStaff),
    application.medicalSpecialties?.map(relationId),
    ...clinicApplicationProvisioningInputFields.map((field) => application[field] ?? null),
  ])
}

export async function ClinicApplicationLifecycleField({ data, id, req }: UIFieldServerProps) {
  const application = await readStagedApplication(req, id)
  const showDecision =
    application &&
    reviewValues(data as Partial<ClinicApplication>) === reviewValues(application) &&
    (application.status === 'submitted' ||
      (application.status === 'approved' && application.mcpOnboardingStaffMode === 'new_account')) &&
    (await platformClinicTrustAccess({ req }))
  const review = showDecision && application ? await readOnboardingStatus(req, application).catch(() => null) : null
  return (
    <>
      <ClinicApplicationLifecyclePanel usesMcpOnboarding={Boolean(application)} />
      {application && review && <OnboardingDecision review={review} reviewedUpdatedAt={application.updatedAt} />}
    </>
  )
}
