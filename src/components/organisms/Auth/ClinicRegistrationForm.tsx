'use client'

import { RegistrationForm } from '@/components/organisms/Auth/RegistrationForm'
import { submitClinicRegistration } from '@/auth/utilities/registrationSubmissions'

type ClinicRegistrationFormProps = {
  containerClassName?: string
}

export function ClinicRegistrationForm({ containerClassName }: ClinicRegistrationFormProps) {
  return (
    <RegistrationForm
      title="Register Clinic"
      description="Register your clinic"
      successMessage="Thanks, your clinic registration has been submitted. We will review it and get back to you soon."
      submitButtonText="Submit Registration"
      containerClassName={containerClassName}
      fields={[
        { name: 'clinicName', label: 'Clinic Name', type: 'text', autoComplete: 'organization', required: true },
        {
          name: 'contactFirstName',
          label: 'First Name',
          type: 'text',
          autoComplete: 'given-name',
          required: true,
          gridCol: '2',
        },
        {
          name: 'contactLastName',
          label: 'Last Name',
          type: 'text',
          autoComplete: 'family-name',
          required: true,
          gridCol: '2',
        },
        { name: 'street', label: 'Street', type: 'text', autoComplete: 'address-line1', required: true, gridCol: '2' },
        {
          name: 'houseNumber',
          label: 'House Number',
          type: 'text',
          autoComplete: 'address-line2',
          required: true,
          gridCol: '2',
        },
        {
          name: 'zipCode',
          label: 'Postal Code',
          type: 'number',
          autoComplete: 'postal-code',
          required: true,
          gridCol: '2',
        },
        { name: 'city', label: 'City', type: 'text', autoComplete: 'address-level2', required: true, gridCol: '2' },
        { name: 'country', label: 'Country', type: 'text', autoComplete: 'country-name', required: true },
        { name: 'contactPhone', label: 'Phone Number', type: 'tel', autoComplete: 'tel' },
        { name: 'contactEmail', label: 'Email', type: 'email', autoComplete: 'email', required: true },
        { name: 'additionalNotes', label: 'Additional Notes', type: 'text' },
      ]}
      links={{ home: { href: '/', text: '← Back to home' } }}
      onSubmit={submitClinicRegistration}
    />
  )
}
