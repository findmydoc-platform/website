import { redirect } from 'next/navigation'
import { hasAdminUsers } from '@/auth/utilities/firstAdminCheck'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const adminUsersExist = await hasAdminUsers()

  if (!adminUsersExist) {
    redirect('first-admin')
  }

  const authData = await extractSupabaseUserData()

  if (authData?.userType === 'clinic' || authData?.userType === 'platform') {
    redirect('/admin')
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <LoginForm.Root userTypes={['clinic', 'platform']} redirectPath="/admin" className="w-full max-w-md">
        <LoginForm.Header title="Staff Login" description="Sign in to your account to continue" />
        <LoginForm.Status />
        <LoginForm.Form>
          <LoginForm.EmailField placeholder="staff@example.com" />
          <LoginForm.PasswordField forgotPasswordHref="/auth/password/reset" />
          <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
        </LoginForm.Form>
      </LoginForm.Root>
    </div>
  )
}
