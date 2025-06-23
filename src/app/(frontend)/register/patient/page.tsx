import { BaseRegistrationForm } from '@/components/Auth/BaseRegistrationForm'

export default async function PatientRegistrationPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <BaseRegistrationForm
        title="Create Patient Account"
        description="Join findmydoc to search for clinics and treatments"
        apiEndpoint="/api/auth/register/patient"
        successRedirect="/?message=patient-registration-success"
        submitButtonText="Create Patient Account"
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
            placeholder: 'patient@example.com',
            required: true,
          },
          { name: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
          { name: 'phone', label: 'Phone Number', type: 'tel', placeholder: '+1 (555) 123-4567' },
          { name: 'password', label: 'Password', type: 'password', required: true, minLength: 6 },
          {
            name: 'confirmPassword',
            label: 'Confirm Password',
            type: 'password',
            required: true,
            minLength: 6,
          },
        ]}
        links={{
          login: { href: '/login/patient', text: 'Sign in here' },
          home: { href: '/', text: '← Back to home' },
        }}
      />
    </div>
  )
}
