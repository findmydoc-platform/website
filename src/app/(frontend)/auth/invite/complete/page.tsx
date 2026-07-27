export const dynamic = 'force-dynamic'

import { getClinicDashboardOrigin } from '@/auth/utilities/clinicDashboardOrigin'
import InviteCompleteForm from './InviteCompleteForm'

export default function InviteCompletePage() {
  const clinicLoginHref = process.env.CLINIC_DASHBOARD_URL?.trim() ? `${getClinicDashboardOrigin()}/login` : undefined

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <InviteCompleteForm clinicLoginHref={clinicLoginHref} />
    </div>
  )
}
