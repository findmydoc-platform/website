'use client'

import { useCallback, useLayoutEffect, useRef, useSyncExternalStore, type ComponentProps } from 'react'

import {
  useLanguageSwitchRoute,
  type LanguageSwitchTargets,
} from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import {
  readChangedPatientAuthInput,
  patientAuthFormInput,
  usePatientAuthFormHandoff,
} from '@/features/languageSwitch/PatientAuthFormHandoff.client'
import { PatientRegistrationForm } from '@/features/patientRegistration/PatientRegistrationForm.client'
import type { UiCopyLocale } from '@/i18n/requestLocale'

import { PATIENT_VERIFICATION_RESEND_ID, PatientVerificationResendForm } from './PatientVerificationResendForm'

const registrationFields = ['firstName', 'lastName', 'email'] as const

function subscribeToHashChange(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function readResendHash() {
  const resendHash = `#${PATIENT_VERIFICATION_RESEND_ID}`
  return window.location.hash === resendHash ? resendHash : ''
}

type Props = {
  registration: Omit<ComponentProps<typeof PatientRegistrationForm>, 'formRef' | 'onSubmit'>
  resend: Omit<ComponentProps<typeof PatientVerificationResendForm>, 'formRef' | 'onRequest'>
  locale: UiCopyLocale
  targets: Required<LanguageSwitchTargets>
}

export function PatientRegistrationForms({ registration, resend, locale, targets }: Props) {
  const registrationForm = useRef<HTMLFormElement>(null)
  const resendForm = useRef<HTMLFormElement>(null)
  const handoff = usePatientAuthFormHandoff()
  const hash = useSyncExternalStore(subscribeToHashChange, readResendHash, () => '')

  const requiresConfirmation = useCallback(() => {
    const form = registrationForm.current
    return Boolean(
      patientAuthFormInput(form, 'password')?.value || patientAuthFormInput(form, 'confirmPassword')?.value,
    )
  }, [])

  const onNavigate = useCallback(
    (href: string) => {
      const form = registrationForm.current
      handoff?.save(href, {
        form: 'registration',
        fields: {
          firstName: readChangedPatientAuthInput(form, 'firstName'),
          lastName: readChangedPatientAuthInput(form, 'lastName'),
          email: readChangedPatientAuthInput(form, 'email'),
        },
        resendEmail: readChangedPatientAuthInput(resendForm.current, 'email'),
      })
    },
    [handoff],
  )

  useLanguageSwitchRoute({
    locale,
    targets: { de: targets.de + hash, en: targets.en + hash },
    requiresConfirmation,
    onNavigate,
  })

  useLayoutEffect(() => {
    const draft = handoff?.take()
    if (draft?.form !== 'registration') return

    for (const name of registrationFields) {
      const field = patientAuthFormInput(registrationForm.current, name)
      const value = draft.fields[name]
      if (field && value !== undefined) field.value = value
    }

    const email = patientAuthFormInput(resendForm.current, 'email')
    if (email && draft.resendEmail !== undefined) email.value = draft.resendEmail
  }, [handoff])

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <PatientRegistrationForm {...registration} formRef={registrationForm} />
      <PatientVerificationResendForm {...resend} formRef={resendForm} />
    </div>
  )
}
