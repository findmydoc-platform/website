import { SelectField } from '@payloadcms/ui'
import type { PayloadRequest, SelectFieldServerProps, UIFieldServerProps } from 'payload'
import { cache } from 'react'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { platformClinicTrustAccess } from '@/access/fieldAccess'
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

export async function ClinicApplicationLifecycleField({ id, req }: UIFieldServerProps) {
  const application = await readStagedApplication(req, id)
  const showDecision =
    application &&
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
