'use client'

import { RegistrationForm } from '@/components/Auth/RegistrationForm'
import { createClient } from '@/auth/utilities/supaBaseClient'

export function PatientRegistrationForm() {
  const handleSubmit = async (formData: Record<string, string>) => {
    const supabase = createClient()

    const email = formData.email ?? ''
    const password = formData.password ?? ''
    const { firstName, lastName } = formData
    if (!email || !password) {
      throw new Error('Email and password are required')
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
      },
    })

    if (error) {
      throw new Error('Registration failed') // Generic message to avoid leaking info
    }

    // Email confirmation is required; Supabase returns a user but no session until the link is
    // clicked. The backend provisions the Payload patient record on first confirmed login.
    if (!data.user) {
      throw new Error('Supabase did not return a user id')
    }
  }

  return (
    <RegistrationForm
      title="Create Patient Account"
      description="Join findmydoc to search for clinics and treatments"
      successRedirect="/login/patient?message=patient-check-email"
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
        // TODO(#429): dateOfBirth/phone values are collected but not persisted yet.
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
      onSubmit={handleSubmit}
    />
  )
}
