import { BaseLoginForm } from '@/components/Auth/BaseLoginForm'

export default async function LoginPage() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 p-6 md:p-10">
      <BaseLoginForm
        title="Patient Login"
        description="Sign in to your patient account to access your medical information"
        userTypes="patient"
        redirectPath="/"
        emailPlaceholder="patient@example.com"
        links={{
          register: { href: '/register/patient', text: 'Register here' },
          home: { href: '/', text: '← Back to home' },
        }}
      />
    </div>
  )
}
