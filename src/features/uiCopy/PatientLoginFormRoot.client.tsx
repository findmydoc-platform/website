'use client'

import { useCallback, useLayoutEffect, useRef, type ComponentProps } from 'react'

import { handleLogin } from '@/auth/utilities/loginHandler'
import { Root } from '@/components/organisms/Auth/LoginForm'
import {
  useLanguageSwitchRoute,
  type LanguageSwitchTargets,
} from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import type { UiCopyLocale } from '@/i18n/requestLocale'

import { usePatientLoginEmailHandoff } from './PatientLoginEmailHandoff.client'
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

function field(form: HTMLFormElement | null, name: string): HTMLInputElement | null {
  const input = form?.elements.namedItem(name)
  return input instanceof HTMLInputElement ? input : null
}

export function PatientLoginFormRoot({ errors, languageSwitch, ...props }: Props) {
  const form = useRef<HTMLFormElement>(null)
  const emailHandoff = usePatientLoginEmailHandoff()
  const requiresConfirmation = useCallback(() => Boolean(field(form.current, 'password')?.value), [])
  const onNavigate = useCallback(
    (href: string) => {
      if (!emailHandoff) return

      const email = field(form.current, 'email')
      emailHandoff.current = email && email.value !== email.defaultValue ? { href, value: email.value } : null
    },
    [emailHandoff],
  )

  useLanguageSwitchRoute(languageSwitch && { ...languageSwitch, requiresConfirmation, onNavigate })

  useLayoutEffect(() => {
    const draft = emailHandoff?.current
    if (!draft || draft.href !== `${window.location.pathname}${window.location.search}`) return

    const email = field(form.current, 'email')
    if (email) email.value = draft.value
    emailHandoff.current = null
  }, [emailHandoff])

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
