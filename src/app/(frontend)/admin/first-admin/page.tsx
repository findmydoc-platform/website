import { redirect } from 'next/navigation'
import { hasAdminUsers } from '@/auth/utilities/firstAdminCheck'
import { FirstAdminRegistrationForm } from '@/components/Auth/FirstAdminRegistrationForm'

export const dynamic = 'force-dynamic'

export default async function FirstAdminSetupPage() {
  const adminUsersExist = await hasAdminUsers()

  if (adminUsersExist) {
    redirect('/admin/login')
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <FirstAdminRegistrationForm />
    </div>
  )
}
