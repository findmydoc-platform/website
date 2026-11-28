import { getTranslations } from 'next-intl/server'

import type { UiCopyLocale } from '@/i18n/requestLocale'
import type { PublicContactSectionProps } from '@/components/organisms/Contact'

export async function publicContactCopy(locale: UiCopyLocale) {
  const translate = await getTranslations({ locale, namespace: 'contact' })

  return {
    title: translate('title'),
    description: translate('description'),
    contactEyebrow: translate('eyebrow'),
    contactConsent: translate('consent'),
    contactHints: {
      compact: translate('compactHint'),
      full: translate('fullHint'),
    },
    primaryCtaLabel: translate('submit'),
    contactFormLabels: {
      namePlaceholder: translate('name'),
      emailPlaceholder: translate('email'),
      messagePlaceholder: translate('message'),
      nameRequiredMessage: translate('nameRequired'),
      emailRequiredMessage: translate('emailRequired'),
      messageRequiredMessage: translate('messageRequired'),
      emailInvalidMessage: translate('invalidEmail'),
      genericErrorMessage: translate('failure'),
      submittingLabel: translate('pending'),
      successMessage: translate('success'),
    },
  } satisfies Partial<PublicContactSectionProps>
}
