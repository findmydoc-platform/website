import { getTranslations } from 'next-intl/server'
import { localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import type { UiCopyLocale } from '@/i18n/requestLocale'

export async function patientVerificationResendCopy() {
  const translate = await getTranslations('auth.patientVerification.resend')

  return {
    title: translate('title'),
    description: translate('description'),
    announcementPending: translate('announcementPending'),
    success: translate('success'),
    error: translate('error'),
    email: translate('email'),
    emailValidation: {
      typeMismatch: translate('invalidEmail'),
      valueMissing: translate('requiredEmail'),
    },
    requesting: translate('requesting'),
    submit: translate('submit'),
  }
}

export type PatientVerificationResendCopy = Awaited<ReturnType<typeof patientVerificationResendCopy>>

export async function patientVerificationCopy(locale: UiCopyLocale) {
  const translate = await getTranslations('auth.patientVerification.confirmation')
  const registrationPath = localizedPatientAuthPath('/register/patient', locale)

  return {
    title: translate('title'),
    description: translate('description'),
    announcementPending: translate('announcementPending'),
    invalid: translate('invalid'),
    retry: translate('retry'),
    inquiryContinuation: translate('inquiryContinuation'),
    completed: translate('completed'),
    confirming: translate('confirming'),
    retryAction: translate('retryAction'),
    continueAction: translate('continueAction'),
    confirm: translate('confirm'),
    resendLink: translate('resendLink'),
    resendHref: `${registrationPath}#patient-verification-resend`,
  }
}

export type PatientVerificationCopy = Awaited<ReturnType<typeof patientVerificationCopy>>

export async function patientVerificationMetadataTitle() {
  const translate = await getTranslations('auth.patientVerification.confirmation')
  return translate('pageTitle')
}
