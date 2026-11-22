'use client'

import { useCallback, useLayoutEffect, useRef, type ComponentProps } from 'react'

import { handleLogin } from '@/auth/utilities/loginHandler'
import { Root } from '@/components/organisms/Auth/LoginForm'
import {
  useLanguageSwitchRoute,
  type LanguageSwitchTargets,
} from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import {
  readChangedPatientAuthInput,
  patientAuthFormInput,
  usePatientAuthFormHandoff,
} from '@/features/languageSwitch/PatientAuthFormHandoff.client'
import type { UiCopyLocale } from '@/i18n/requestLocale'

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

type Props = Omit<ComponentProps<typeof Root>, 'userTypes' | 'loginHandler' | 'unexpectedErrorText' | 'formRef'> & {
  errors: ErrorCopy
  languageSwitch?: { locale: UiCopyLocale; targets: LanguageSwitchTargets }
}

export function PatientLoginFormRoot({ errors, languageSwitch, ...props }: Props) {
  const form = useRef<HTMLFormElement>(null)
  const handoff = usePatientAuthFormHandoff()
  const requiresConfirmation = useCallback(() => Boolean(patientAuthFormInput(form.current, 'password')?.value), [])
  const onNavigate = useCallback(
    (href: string) => {
      const email = readChangedPatientAuthInput(form.current, 'email')
      if (email !== undefined) handoff?.save(href, { form: 'login', email })
    },
    [handoff],
  )

  useLanguageSwitchRoute(languageSwitch && { ...languageSwitch, requiresConfirmation, onNavigate })

  useLayoutEffect(() => {
    const draft = handoff?.take()
    if (draft?.form !== 'login') return

    const email = patientAuthFormInput(form.current, 'email')
    if (email) email.value = draft.email
  }, [handoff])

  return (
    <Root
      {...props}
      formRef={form}
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
