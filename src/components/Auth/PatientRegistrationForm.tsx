'use client'

import { RegistrationForm } from '@/components/Auth/RegistrationForm'
import { createClient } from '@/auth/utilities/supaBaseClient'

export function PatientRegistrationForm() {
  const handleSubmit = async (formData: Record<string, string>) => {
    const supabase = createClient()

    const email = formData.email ?? ''
    const password = formData.password ?? ''
    const { firstName, lastName, dateOfBirth } = formData
    if (!email || !password) {
      throw new Error('Email and password are required')
    }
    const normalizedPhone = formData.phoneNumber ?? formData.phone

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
      throw new Error(`Supabase signup failed: ${error.message}`)
    }

    const user = data.user
    if (!user) {
      throw new Error('Supabase did not return a user id')
    }

    const response = await fetch('/api/auth/register/patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        firstName,
        lastName,
        dateOfBirth,
        phoneNumber: normalizedPhone,
        supabaseUserId: user.id,
      }),
    })

    const result = await response.json()
    if (!response.ok) {
      throw new Error(result.error || 'Patient registration finalization failed')
    }
  }

  return (
    <RegistrationForm
      title="Create Patient Account"
      description="Join findmydoc to search for clinics and treatments"
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
      onSubmit={handleSubmit}
    />
  )
}
