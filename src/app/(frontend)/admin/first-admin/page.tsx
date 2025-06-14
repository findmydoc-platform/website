import { redirect } from 'next/navigation'
import { hasAdminUsers } from '@/utilities/firstAdminCheck'
import FirstAdminForm from '@/components/Auth/Admin/FirstAdminForm'

export default async function FirstAdminSetupPage() {
  // Check if admin users already exist
  const adminUsersExist = await hasAdminUsers()

  if (adminUsersExist) {
    // Redirect to login if admin users already exist
    redirect('/admin/login')
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <FirstAdminForm />
      </div>
    </div>
  )
}
