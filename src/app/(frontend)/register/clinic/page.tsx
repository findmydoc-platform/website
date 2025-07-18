import { BaseRegistrationForm } from '@/components/Auth/BaseRegistrationForm'

export default function ClinicRegistrationPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <BaseRegistrationForm
        title="Register Clinic"
        description="Register your clinic"
        apiEndpoint="/api/forms/clinic-registration"
        successRedirect="/?message=clinic-submitted"
        submitButtonText="Submit Registration"
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
        ]}
        links={{ home: { href: '/', text: '← Back to home' } }}
      />
    </div>
  )
}
