import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'

import type { UiCopyLocale } from '@/i18n/requestLocale'

function createClinicProfileTranslator(locale: UiCopyLocale) {
  return createTranslator({
    locale,
    messages: locale === 'de' ? germanMessages : englishMessages,
    namespace: 'website.clinicProfile',
  })
}

const translators = {
  de: createClinicProfileTranslator('de'),
  en: createClinicProfileTranslator('en'),
}

export function getClinicProfileTranslator(locale: UiCopyLocale) {
  return translators[locale]
}
