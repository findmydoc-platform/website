'use client'

import { RegistrationForm } from '@/components/organisms/Auth/RegistrationForm'
import { submitClinicRegistration } from '@/auth/utilities/registrationSubmissions'

export function ClinicRegistrationForm() {
  return (
    <RegistrationForm
      title="Register Clinic"
      description="Register your clinic"
      successMessage="Thanks, your clinic registration has been submitted. We will review it and get back to you soon."
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
      onSubmit={submitClinicRegistration}
    />
  )
}
