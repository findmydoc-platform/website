'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RegistrationForm, type RegistrationSubmitHandler } from '@/components/organisms/Auth/RegistrationForm'
import { submitFirstAdminRegistration } from '@/auth/utilities/registrationSubmissions'

type FirstAdminRegistrationFormProps = {
  onSubmit?: RegistrationSubmitHandler
}

export function FirstAdminRegistrationForm({
  onSubmit = submitFirstAdminRegistration,
}: FirstAdminRegistrationFormProps) {
  const router = useRouter()

  return (
    <RegistrationForm
      title="Create First Admin User"
      description="Set up your platform administrator account"
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
      onSubmit={onSubmit}
      onSuccess={() => {
        startTransition(() => {
          router.push('/admin')
          router.refresh()
        })
      }}
    />
  )
}
