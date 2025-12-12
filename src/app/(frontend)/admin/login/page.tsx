import { redirect } from 'next/navigation'
import { hasAdminUsers } from '@/auth/utilities/firstAdminCheck'
import { extractSupabaseUserData } from '@/auth/utilities/jwtValidation'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { findUserBySupabaseId, isClinicUserApproved } from '@/auth/utilities/userLookup'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  const adminUsersExist = await hasAdminUsers()

  if (!adminUsersExist) {
    redirect('first-admin')
  }

  const authData = await extractSupabaseUserData()

  console.debug({ authData }, 'Auth data on login page')

  let statusMessage: string | undefined
  let statusVariant: 'success' | 'info' | 'warning' | undefined

  if (authData) {
    // Only attempt redirect for staff types
    if (authData.userType === 'clinic' || authData.userType === 'platform') {
      const payload = await getPayload({ config: configPromise })
      const user = await findUserBySupabaseId(payload, authData)

      if (user) {
        if (authData.userType === 'clinic') {
          const isApproved = await isClinicUserApproved(payload, String(user.id))
          if (isApproved) {
            redirect('/admin')
          } else {
            statusMessage = 'Your account is pending approval. Please contact support.'
            statusVariant = 'warning'
          }
        } else {
          // Platform users are always allowed if they exist
          redirect('/admin')
        }
      } else {
        // User exists in Supabase but not Payload. Redirect to trigger creation.
        redirect('/admin')
      }
    }
  }

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <LoginForm.Root userTypes={['clinic', 'platform']} redirectPath="/admin" className="w-full max-w-md">
        <LoginForm.Header title="Staff Login" description="Sign in to your account to continue" />
        <LoginForm.Status message={statusMessage} variant={statusVariant} />
        <LoginForm.Form>
          <LoginForm.EmailField placeholder="staff@example.com" />
          <LoginForm.PasswordField forgotPasswordHref="/auth/password/reset" />
          <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
        </LoginForm.Form>
      </LoginForm.Root>
    </div>
  )
}
