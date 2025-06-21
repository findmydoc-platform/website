import { BaseLoginForm } from '@/components/Auth/BaseLoginForm'

export default async function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <BaseLoginForm
        title="Patient Login"
        description="Sign in to your patient account to access your medical information"
        redirectPath="/?message=patient-login-success"
        emailPlaceholder="patient@example.com"
        links={{
          register: { href: '/register/patient', text: 'Register here' },
          home: { href: '/', text: '← Back to home' },
        }}
      />
    </div>
  )
}
