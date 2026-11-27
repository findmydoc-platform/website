import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import type { UiCopyLocale } from '@/i18n/requestLocale'
import { authCopySentences } from './patientAuthPresentation'

export async function patientLoginCopy(inquiryExpiresAt?: string, afterRegistration = false) {
  const [translate, locale, formatter, verificationCopy] = await Promise.all([
    getTranslations('auth.patientLogin'),
    getLocale(),
    inquiryExpiresAt ? getFormatter() : undefined,
    afterRegistration && inquiryExpiresAt ? getTranslations('auth.patientVerification.confirmation') : undefined,
  ])
  const required = translate('validation.required')
  const routeLocale: UiCopyLocale = locale === 'de' ? 'de' : 'en'

  const checkEmail = translate('status.checkEmail')
  const [intro, ...details] = authCopySentences(checkEmail, routeLocale)
  const registrationConfirmation = {
    title: details.length ? (intro ?? translate('title')) : translate('title'),
    message: details.join(' ') || checkEmail,
  }
  const inquirySaved =
    inquiryExpiresAt && formatter
      ? translate('status.inquirySaved', {
          expiresAt: formatter.dateTime(new Date(inquiryExpiresAt), {
            dateStyle: 'short',
            timeStyle: 'medium',
            timeZone: 'UTC',
          }),
        })
      : undefined

  // The shared catalog supplies the saved state, sign-in instruction, and deadline as one message.
  const [savedStatus, , ...deadline] = inquirySaved ? authCopySentences(inquirySaved, routeLocale) : []
  const inquiryConfirmation =
    verificationCopy && inquiryExpiresAt && savedStatus && deadline.length
      ? {
          title: details.length ? registrationConfirmation.title : verificationCopy('title'),
          guidance: verificationCopy('description'),
          savedStatus,
          deadline: deadline.join(' '),
          expiresAt: inquiryExpiresAt,
        }
      : undefined

  return {
    locale: routeLocale,
    title: translate('title'),
    description: translate('description'),
    emailLabel: translate('email.label'),
    emailPlaceholder: translate('email.placeholder'),
    passwordLabel: translate('password.label'),
    forgotPassword: translate('password.forgot'),
    submit: translate('submit'),
    submitting: translate('submitting'),
    noAccount: translate('noAccount'),
    register: translate('register'),
    backHome: translate('backHome'),
    requestVerificationEmail: translate('requestVerificationEmail'),
    registrationConfirmation,
    passwordResetComplete: translate('status.passwordResetComplete'),
    inquirySaved,
    inquiryConfirmation,
    errors: {
      invalidCredentials: translate('errors.invalidCredentials'),
      emailNotConfirmed: translate('errors.emailNotConfirmed'),
      authenticationFailed: translate('errors.authenticationFailed'),
      invalidRequest: translate('errors.invalidRequest'),
      requestRejected: translate('errors.requestRejected'),
      wrongAccountType: translate('errors.wrongAccountType'),
      internal: translate('errors.internal'),
      network: translate('errors.network'),
      unexpected: translate('errors.unexpected'),
    },
    validationMessages: {
      email: { valueMissing: required, typeMismatch: translate('validation.emailInvalid') },
      password: { valueMissing: required },
    },
  }
}
