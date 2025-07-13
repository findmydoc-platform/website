import { redirect } from 'next/navigation'
import { hasAdminUsers } from '@/auth/utilities/firstAdminCheck'
import { BaseLoginForm } from '@/components/Auth/BaseLoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const adminUsersExist = await hasAdminUsers()

  if (!adminUsersExist) {
    redirect('first-admin')
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <BaseLoginForm
        title="Staff Login"
        description="Sign in to your account to continue"
        userTypes={['clinic', 'platform']}
        redirectPath="/admin"
        emailPlaceholder="staff@example.com"
      />
    </div>
  )
}
