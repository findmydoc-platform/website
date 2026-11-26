import { getLocale, getTranslations } from 'next-intl/server'

import { localizedPatientAuthPath } from '@/i18n/patientAuthPath'
import { RECOVERY_PASSWORD_MIN_LENGTH } from '@/auth/actions/websiteRecoveryPassword'
import type { UiCopyLocale } from '@/i18n/requestLocale'
import { authCopySentences } from './patientAuthPresentation'

export async function recoveryMetadataTitle(page: 'request' | 'confirmation' | 'completion', locale?: UiCopyLocale) {
  const namespace = `auth.passwordRecovery.${page}` as const
  const translate = locale ? await getTranslations({ locale, namespace }) : await getTranslations(namespace)
  return translate('pageTitle')
}

export async function recoveryRequestCopy(preparationExpiresAt?: string) {
  const [translate, locale] = await Promise.all([getTranslations('auth.passwordRecovery.request'), getLocale()])
  const preparationNotice = preparationExpiresAt
    ? translate('savedInquiry', {
        expiresAt: new Date(preparationExpiresAt).toLocaleString(locale === 'de' ? 'de-DE' : 'en-GB', {
          timeZone: 'UTC',
        }),
      })
    : undefined

  const success = translate('success')
  return {
    signInOptions: translate('signInOptions'),
    patientSignIn: translate('patientSignIn'),
    patientSignInHref: localizedPatientAuthPath('/login/patient', locale === 'de' ? 'de' : 'en'),
    staffSignIn: translate('staffSignIn'),
    preparationNotice,
    form: {
      title: translate('title'),
      description: translate('description'),
      expired: translate('expired'),
      email: translate('email'),
      invalidEmail: translate('invalidEmail'),
      requiredEmail: translate('requiredEmail'),
      invalidRequest: translate('invalidRequest'),
      unavailable: translate('unavailable'),
      success,
      successTitle: translate('pageTitle'),
      sending: translate('sending'),
      submit: translate('submit'),
    },
  }
}

export type RecoveryRequestFormCopy = Awaited<ReturnType<typeof recoveryRequestCopy>>['form']

async function sharedRecoveryCopy() {
  const [translate, locale] = await Promise.all([getTranslations('auth.passwordRecovery.shared'), getLocale()])
  const copy = translate('invalidLink')
  const [title, ...details] = authCopySentences(copy, locale === 'de' ? 'de' : 'en')
  return {
    invalidTitle: title ?? copy,
    invalidLink: details.join(' ') || copy,
    retry: translate('retry'),
    requestLink: {
      label: translate('requestLink'),
      href: localizedPatientAuthPath('/auth/password/reset', locale === 'de' ? 'de' : 'en'),
    },
  }
}

export async function recoveryConfirmationCopy() {
  const [translate, shared] = await Promise.all([
    getTranslations('auth.passwordRecovery.confirmation'),
    sharedRecoveryCopy(),
  ])
  return {
    shared,
    title: translate('title'),
    description: translate('description'),
    pending: translate('pending'),
    unavailable: translate('unavailable'),
    completed: translate('completed'),
    confirming: translate('confirming'),
    submit: translate('submit'),
  }
}

export type RecoveryConfirmationCopy = Awaited<ReturnType<typeof recoveryConfirmationCopy>>

export async function recoveryCompletionCopy() {
  const [translate, shared, registration] = await Promise.all([
    getTranslations('auth.passwordRecovery.completion'),
    sharedRecoveryCopy(),
    getTranslations('auth.patientRegistration'),
  ])
  const passwordHint = registration('passwordTooShort', { minimum: RECOVERY_PASSWORD_MIN_LENGTH })
  return {
    shared,
    title: translate('title'),
    description: translate('description'),
    resumeTitle: translate('resumeTitle'),
    resumeDescription: translate('resumeDescription'),
    inquiryTitle: translate('inquiryTitle'),
    inquiryDescription: translate('inquiryDescription'),
    password: translate('password'),
    passwordHint,
    confirmPassword: translate('confirmPassword'),
    requiredPassword: translate('requiredPassword'),
    requiredConfirmation: translate('requiredConfirmation'),
    shortPassword: passwordHint,
    longPassword: translate('longPassword'),
    mismatchedPassword: translate('mismatchedPassword'),
    pending: translate('pending'),
    unavailable: translate('unavailable'),
    rejected: translate('rejected'),
    completed: translate('completed'),
    inquiryPending: translate('inquiryPending'),
    finishing: translate('finishing'),
    openingSignIn: translate('openingSignIn'),
    continueInquiries: translate('continueInquiries'),
    finish: translate('finish'),
    submit: translate('submit'),
  }
}

export type RecoveryCompletionCopy = Awaited<ReturnType<typeof recoveryCompletionCopy>>
