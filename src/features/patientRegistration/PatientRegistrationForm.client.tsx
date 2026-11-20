'use client'

import { startTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RegistrationForm, type RegistrationSubmitHandler } from '@/components/organisms/Auth/RegistrationForm'
import { submitPatientRegistration } from '@/auth/utilities/registrationSubmissions'
import type { PatientRegistrationCopy } from '@/features/uiCopy/patientRegistration'

type PatientRegistrationFormProps = Readonly<{
  copy: PatientRegistrationCopy
  initialValues?: Record<string, string>
  containerClassName?: string
  onSubmit?: RegistrationSubmitHandler
  loginHref: string
  successHref: string
}>

export function PatientRegistrationForm({
  copy,
  containerClassName,
  initialValues,
  onSubmit,
  loginHref,
  successHref,
}: PatientRegistrationFormProps) {
  const router = useRouter()

  const submit = async (formData: Record<string, string>) => {
    const failure = await submitPatientRegistration(formData).catch(() => 'registrationFailed' as const)
    if (failure) throw new Error(copy.errors[failure])
  }

  return (
    <RegistrationForm
      title={copy.title}
      description={copy.description}
      fields={copy.fields}
      initialValues={initialValues}
      submitButtonText={copy.submitButtonText}
      successMessage={copy.successMessage}
      formMessages={copy.formMessages}
      links={{
        login: { href: loginHref, text: copy.signInLink },
        home: { href: '/', text: copy.homeLink },
      }}
      containerClassName={containerClassName}
      onSubmit={onSubmit ?? submit}
      onSuccess={() => {
        startTransition(() => {
          router.push(successHref)
        })
      }}
    />
  )
}
