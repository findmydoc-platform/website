import type { ComponentProps } from 'react'
import { getFormatter, getTranslations } from 'next-intl/server'
import type { RegistrationForm } from '@/components/organisms/Auth/RegistrationForm'

type RegistrationFormProps = ComponentProps<typeof RegistrationForm>
export type PatientRegistrationCopy = Pick<
  RegistrationFormProps,
  'title' | 'description' | 'submitButtonText' | 'fields' | 'successMessage' | 'formMessages'
> & {
  signInLink: string
  homeLink: string
  errors: Record<
    | 'missingCredentials'
    | 'invalidPayload'
    | 'requestRejected'
    | 'temporarilyUnavailable'
    | 'setupFailed'
    | 'registrationFailed',
    string
  >
}

const minimumPasswordLength = 6

export async function patientRegistrationCopy(preparationExpiresAt?: string): Promise<PatientRegistrationCopy> {
  const [translate, format] = await Promise.all([getTranslations('auth.patientRegistration'), getFormatter()])
  const title = translate('title')
  const fieldRequired = { valueMissing: translate('fieldRequired') }
  const passwordValidation = {
    ...fieldRequired,
    tooShort: translate('passwordTooShort', { minimum: minimumPasswordLength }),
  }

  const registrationFailed = translate('registrationFailed')

  return {
    title,
    description: preparationExpiresAt
      ? translate('preparationDescription', {
          expiration: format.dateTime(new Date(preparationExpiresAt), {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hourCycle: 'h23',
            timeZone: 'UTC',
          }),
        })
      : translate('description'),
    submitButtonText: title,
    fields: [
      {
        name: 'firstName',
        label: translate('firstName'),
        type: 'text',
        autoComplete: 'given-name',
        placeholder: translate('firstNamePlaceholder'),
        required: true,
        gridCol: '2',
      },
      {
        name: 'lastName',
        label: translate('lastName'),
        type: 'text',
        autoComplete: 'family-name',
        placeholder: translate('lastNamePlaceholder'),
        required: true,
        gridCol: '2',
      },
      {
        name: 'email',
        label: translate('email'),
        type: 'email',
        autoComplete: 'email',
        placeholder: translate('emailPlaceholder'),
        required: true,
      },
      {
        name: 'password',
        label: translate('password'),
        type: 'password',
        autoComplete: 'new-password',
        required: true,
        minLength: minimumPasswordLength,
        hint: passwordValidation.tooShort,
      },
      {
        name: 'confirmPassword',
        label: translate('confirmPassword'),
        type: 'password',
        autoComplete: 'new-password',
        required: true,
        minLength: minimumPasswordLength,
      },
    ],
    formMessages: {
      validation: {
        firstName: fieldRequired,
        lastName: fieldRequired,
        email: { ...fieldRequired, typeMismatch: translate('invalidEmail') },
        password: passwordValidation,
        confirmPassword: passwordValidation,
      },
      passwordMismatch: translate('passwordMismatch'),
      pending: translate('pending'),
      loginPrompt: translate('alreadyHaveAccount'),
      fallbackError: registrationFailed,
    },
    successMessage: translate('success'),
    signInLink: translate('signInLink'),
    homeLink: translate('homeLink'),
    errors: {
      missingCredentials: translate('missingCredentials'),
      invalidPayload: translate('invalidPayload'),
      requestRejected: translate('requestRejected'),
      temporarilyUnavailable: translate('temporarilyUnavailable'),
      setupFailed: translate('setupFailed'),
      registrationFailed,
    },
  }
}
