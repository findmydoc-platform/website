import { getLocale, getTranslations } from 'next-intl/server'

import { localizedPatientAuthPath } from '@/i18n/patientAuthPath'

export async function recoveryMetadataTitle(page: 'request' | 'confirmation' | 'completion') {
  const translate = await getTranslations(`auth.passwordRecovery.${page}`)
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
      success: translate('success'),
      sending: translate('sending'),
      submit: translate('submit'),
    },
  }
}

export type RecoveryRequestFormCopy = Awaited<ReturnType<typeof recoveryRequestCopy>>['form']

async function sharedRecoveryCopy() {
  const [translate, locale] = await Promise.all([getTranslations('auth.passwordRecovery.shared'), getLocale()])
  return {
    invalidLink: translate('invalidLink'),
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
  const [translate, shared] = await Promise.all([
    getTranslations('auth.passwordRecovery.completion'),
    sharedRecoveryCopy(),
  ])
  return {
    shared,
    title: translate('title'),
    description: translate('description'),
    resumeTitle: translate('resumeTitle'),
    resumeDescription: translate('resumeDescription'),
    inquiryTitle: translate('inquiryTitle'),
    inquiryDescription: translate('inquiryDescription'),
    password: translate('password'),
    confirmPassword: translate('confirmPassword'),
    requiredPassword: translate('requiredPassword'),
    requiredConfirmation: translate('requiredConfirmation'),
    shortPassword: translate('shortPassword'),
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
