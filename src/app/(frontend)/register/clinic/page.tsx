import { BaseRegistrationForm } from '@/components/Auth/BaseRegistrationForm'

export default function ClinicRegistrationPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <BaseRegistrationForm
        title="Register Clinic"
        description="Create your clinic account and staff login"
        apiEndpoint="/api/register/clinic"
        successRedirect="/?message=clinic-submitted"
        submitButtonText="Register Clinic"
        fields={[
          { name: 'clinicName', label: 'Clinic Name', type: 'text', required: true },
          { name: 'firstName', label: 'First Name', type: 'text', required: true, gridCol: '2' },
          { name: 'lastName', label: 'Last Name', type: 'text', required: true, gridCol: '2' },
          { name: 'street', label: 'Street', type: 'text', required: true, gridCol: '2' },
          { name: 'houseNumber', label: 'House Number', type: 'text', required: true, gridCol: '2' },
          { name: 'zipCode', label: 'Postal Code', type: 'number', required: true, gridCol: '2' },
          { name: 'city', label: 'City', type: 'text', required: true, gridCol: '2' },
          { name: 'phoneNumber', label: 'Phone Number', type: 'tel', required: true },
          { name: 'email', label: 'Email', type: 'email', required: true },
          { name: 'password', label: 'Password', type: 'password', required: true },
          { name: 'confirmPassword', label: 'Confirm Password', type: 'password', required: true },
        ]}
        links={{ home: { href: '/', text: '← Back to home' } }}
      />
    </div>
  )
}
