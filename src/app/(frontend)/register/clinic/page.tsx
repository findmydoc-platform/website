import { BaseRegistrationForm } from '@/components/Auth/BaseRegistrationForm'

export default async function ClinicRegistrationPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <BaseRegistrationForm
        title="Register Clinic Staff Account"
        description="Join as clinic staff to manage your clinic operations and patient interactions"
        apiEndpoint="/api/auth/register/clinic"
        successRedirect="/?message=clinic-registration-success"
        submitButtonText="Register Clinic Staff"
        fields={[
          {
            name: 'firstName',
            label: 'First Name',
            type: 'text',
            placeholder: 'John',
            required: true,
            gridCol: '2',
          },
          {
            name: 'lastName',
            label: 'Last Name',
            type: 'text',
            placeholder: 'Doe',
            required: true,
            gridCol: '2',
          },
          {
            name: 'email',
            label: 'Email',
            type: 'email',
            placeholder: 'staff@clinic.com',
            required: true,
          },
          {
            name: 'password',
            label: 'Password',
            type: 'password',
            required: true,
            minLength: 6,
          },
          {
            name: 'confirmPassword',
            label: 'Confirm Password',
            type: 'password',
            required: true,
            minLength: 6,
          },
        ]}
        links={{
          login: { href: '/admin/login', text: 'Already approved? Sign in here' },
          home: { href: '/', text: '← Back to home' },
        }}
      />
    </div>
  )
}
