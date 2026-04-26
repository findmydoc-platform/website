'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RegistrationForm } from '@/components/organisms/Auth/RegistrationForm'
import { submitPatientRegistration } from '@/auth/utilities/registrationSubmissions'

export function PatientRegistrationForm() {
  const router = useRouter()

  return (
    <RegistrationForm
      title="Create Patient Account"
      description="Join findmydoc to search for clinics and treatments"
      submitButtonText="Create Patient Account"
      fields={[
        {
          name: 'firstName',
          label: 'First Name',
          type: 'text',
          autoComplete: 'given-name',
          placeholder: 'John',
          required: true,
          gridCol: '2',
        },
        {
          name: 'lastName',
          label: 'Last Name',
          type: 'text',
          autoComplete: 'family-name',
          placeholder: 'Doe',
          required: true,
          gridCol: '2',
        },
        {
          name: 'email',
          label: 'Email',
          type: 'email',
          autoComplete: 'email',
          placeholder: 'patient@example.com',
          required: true,
        },
        {
          name: 'password',
          label: 'Password',
          type: 'password',
          autoComplete: 'new-password',
          required: true,
          minLength: 6,
        },
        {
          name: 'confirmPassword',
          label: 'Confirm Password',
          type: 'password',
          autoComplete: 'new-password',
          required: true,
          minLength: 6,
        },
      ]}
      links={{
        login: { href: '/login/patient', text: 'Sign in here' },
        home: { href: '/', text: '← Back to home' },
      }}
      onSubmit={submitPatientRegistration}
      onSuccess={() => {
        startTransition(() => {
          router.push('/login/patient?message=patient-check-email')
        })
      }}
    />
  )
}
