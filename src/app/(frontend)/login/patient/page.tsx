import { BaseLoginForm } from '@/components/Auth/BaseLoginForm'

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
      <BaseLoginForm
        title="Patient Login"
        description="Sign in to your patient account to access your medical information"
        userTypes="patient"
        redirectPath="/"
        emailPlaceholder="patient@example.com"
        statusMessage={statusMessage}
        links={{
          register: { href: '/register/patient', text: 'Register here' },
          home: { href: '/', text: '← Back to home' },
        }}
      />
    </div>
  )
}
