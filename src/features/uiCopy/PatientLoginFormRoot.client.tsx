'use client'

import type { ComponentProps } from 'react'

import { handleLogin } from '@/auth/utilities/loginHandler'
import { Root } from '@/components/organisms/Auth/LoginForm'
import type { patientLoginCopy } from './patientLogin'

type ErrorCopy = Awaited<ReturnType<typeof patientLoginCopy>>['errors']

// The existing login endpoint reports failures as text. Only catalog messages reach the patient form.
const errorKeys = new Map<string, keyof ErrorCopy>([
  ['Invalid login credentials', 'invalidCredentials'],
  ['Email not confirmed', 'emailNotConfirmed'],
  ['Authentication failed', 'authenticationFailed'],
  ['Invalid request', 'invalidRequest'],
  ['Request rejected.', 'requestRejected'],
  ['This login is for patient users only. Please use the correct login page.', 'wrongAccountType'],
  ['Internal server error', 'internal'],
  ['Network error', 'network'],
])

type Props = Omit<ComponentProps<typeof Root>, 'userTypes' | 'loginHandler' | 'unexpectedErrorText'> & {
  errors: ErrorCopy
}

export function PatientLoginFormRoot({ errors, ...props }: Props) {
  return (
    <Root
      {...props}
      userTypes="patient"
      unexpectedErrorText={errors.unexpected}
      loginHandler={async (request) => {
        const result = await handleLogin(request)
        if ('error' in result) {
          return { error: errors[errorKeys.get(result.error) ?? 'unexpected'] }
        }
        return result
      }}
    />
  )
}
