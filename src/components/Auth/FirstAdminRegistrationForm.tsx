'use client'

import { RegistrationForm } from '@/components/Auth/RegistrationForm'

type FormDataShape = Record<string, string>

export function FirstAdminRegistrationForm() {
  const handleSubmit = async (formData: FormDataShape) => {
    const response = await fetch('/api/auth/register/first-admin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    })

    const result = await response.json()

    if (!response.ok) {
      throw new Error(result.error || 'First admin registration failed')
    }
  }

  return (
    <RegistrationForm
      title="Create First Admin User"
      description="Set up your platform administrator account"
      successRedirect="/admin"
      submitButtonText="Create Admin User"
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
          placeholder: 'admin@example.com',
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
      onSubmit={handleSubmit}
    />
  )
}
