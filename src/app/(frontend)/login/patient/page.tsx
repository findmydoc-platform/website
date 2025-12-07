import { LoginForm } from '@/components/organisms/Auth/LoginForm'
import Link from 'next/link'

const patientLoginMessages: Record<string, { text: string; variant?: 'success' | 'info' | 'warning' }> = {
  'patient-check-email': {
    text: 'Check your email for the verification link we sent so you can finish setting up your findmydoc account.',
    variant: 'success',
  },
}

export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ message?: string }>
}) {
  const resolvedSearchParams = await searchParamsPromise
  const messageKey = resolvedSearchParams?.message
  const statusMessage = messageKey ? patientLoginMessages[messageKey] : undefined

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <LoginForm.Root userTypes="patient" redirectPath="/" className="w-full max-w-md">
        <LoginForm.Header
          title="Patient Login"
          description="Sign in to your patient account to access your medical information"
        />
        <LoginForm.Status message={statusMessage?.text} variant={statusMessage?.variant} />
        <LoginForm.Form>
          <LoginForm.EmailField placeholder="patient@example.com" />
          <LoginForm.PasswordField forgotPasswordHref="/auth/password/reset" />
          <LoginForm.SubmitButton>Sign in</LoginForm.SubmitButton>
        </LoginForm.Form>
        <LoginForm.Footer>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register/patient" className="text-primary hover:underline">
              Register here
            </Link>
          </p>
          <p className="text-sm text-muted-foreground">
            <Link href="/" className="text-primary hover:underline">
              ← Back to home
            </Link>
          </p>
        </LoginForm.Footer>
      </LoginForm.Root>
    </div>
  )
}
