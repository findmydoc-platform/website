import { BaseRegistrationForm } from '@/components/Auth/BaseRegistrationForm'

export default function ClinicRegistrationPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <BaseRegistrationForm
        title="Register Clinic"
        description="Register your clinic"
        apiEndpoint="/api/register/clinic"
        successRedirect="/?message=clinic-registration-submitted"
        submitButtonText="Submit Registration"
        fields={[
          { name: 'clinicName', label: 'Clinic Name', type: 'text', required: true },
          { name: 'contactFirstName', label: 'First Name', type: 'text', required: true, gridCol: '2' },
          { name: 'contactLastName', label: 'Last Name', type: 'text', required: true, gridCol: '2' },
          { name: 'street', label: 'Street', type: 'text', required: true, gridCol: '2' },
          { name: 'houseNumber', label: 'House Number', type: 'text', required: true, gridCol: '2' },
          { name: 'zipCode', label: 'Postal Code', type: 'number', required: true, gridCol: '2' },
          { name: 'city', label: 'City', type: 'text', required: true, gridCol: '2' },
          { name: 'country', label: 'Country', type: 'text', required: true },
          { name: 'contactPhone', label: 'Phone Number', type: 'tel' },
          { name: 'contactEmail', label: 'Email', type: 'email', required: true },
          { name: 'additionalNotes', label: 'Additional Notes', type: 'text' },
        ]}
        links={{ home: { href: '/', text: '← Back to home' } }}
      />
    </div>
  )
}
