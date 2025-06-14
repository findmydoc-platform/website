import { redirect } from 'next/navigation'
import { hasAdminUsers } from '@/utilities/firstAdminCheck'
import AuthForm from '@/components/Auth/Admin/AuthForm'

export default async function LoginPage() {
  // Check if any admin users exist
  const adminUsersExist = await hasAdminUsers()

  if (!adminUsersExist) {
    // Redirect to first user registration if no admin users exist
    redirect('first-admin')
  }

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <AuthForm />
      </div>
    </div>
  )
}
