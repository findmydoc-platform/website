import { SelectField } from '@payloadcms/ui'
import type { PayloadRequest, SelectFieldServerProps, UIFieldServerProps } from 'payload'
import { cache } from 'react'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { ClinicApplicationLifecyclePanel } from './index'

const readUsesMcpOnboarding = cache(async (req: PayloadRequest, id?: number | string) => {
  if (id === undefined || !(await isPlatformStaff({ req }))) return false
  const application = await req.payload.findByID({
    collection: 'clinicApplications',
    id,
    depth: 0,
    disableErrors: true,
    select: { mcpOnboardingStaffMode: true },
    overrideAccess: true,
    req,
  })
  return Boolean(application?.mcpOnboardingStaffMode)
})

export async function ClinicApplicationStatusField({ clientField, id, path, readOnly, req }: SelectFieldServerProps) {
  const usesMcpOnboarding = await readUsesMcpOnboarding(req, id)
  return <SelectField field={clientField} path={path} readOnly={readOnly || usesMcpOnboarding} />
}

export async function ClinicApplicationLifecycleField({ id, req }: UIFieldServerProps) {
  return <ClinicApplicationLifecyclePanel usesMcpOnboarding={await readUsesMcpOnboarding(req, id)} />
}
