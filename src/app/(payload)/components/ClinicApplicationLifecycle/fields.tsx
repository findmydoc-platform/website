import { SelectField } from '@payloadcms/ui'
import type { PayloadRequest, SelectFieldServerProps, UIFieldServerProps } from 'payload'
import { cache } from 'react'
import { isPlatformStaff } from '@/access/isPlatformStaff'
import { ClinicApplicationLifecyclePanel } from './index'

const readStaffMode = cache(async (req: PayloadRequest, id?: number | string) => {
  if (id === undefined || !(await isPlatformStaff({ req }))) return undefined
  const application = await req.payload.findByID({
    collection: 'clinicApplications',
    id,
    depth: 0,
    disableErrors: true,
    select: { mcpOnboardingStaffMode: true },
    overrideAccess: true,
    req,
  })
  return application?.mcpOnboardingStaffMode
})

export async function ClinicApplicationStatusField({ clientField, id, path, readOnly, req }: SelectFieldServerProps) {
  const staffMode = await readStaffMode(req, id)
  return <SelectField field={clientField} path={path} readOnly={readOnly || Boolean(staffMode)} />
}

export async function ClinicApplicationLifecycleField({ id, req }: UIFieldServerProps) {
  return <ClinicApplicationLifecyclePanel staffMode={await readStaffMode(req, id)} />
}
