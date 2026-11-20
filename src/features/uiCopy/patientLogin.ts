import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import type { UiCopyLocale } from '@/i18n/requestLocale'

export async function patientLoginCopy(inquiryExpiresAt?: string) {
  const [translate, locale, formatter] = await Promise.all([
    getTranslations('auth.patientLogin'),
    getLocale(),
    inquiryExpiresAt ? getFormatter() : undefined,
  ])
  const required = translate('validation.required')
  const routeLocale: UiCopyLocale = locale === 'de' ? 'de' : 'en'

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
    checkEmail: translate('status.checkEmail'),
    passwordResetComplete: translate('status.passwordResetComplete'),
    inquirySaved:
      inquiryExpiresAt && formatter
        ? translate('status.inquirySaved', {
            expiresAt: formatter.dateTime(new Date(inquiryExpiresAt), {
              dateStyle: 'short',
              timeStyle: 'medium',
              timeZone: 'UTC',
            }),
          })
        : undefined,
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
