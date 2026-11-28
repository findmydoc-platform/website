import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'

import type { UiCopyLocale } from '@/i18n/requestLocale'

function createSavedClinicsTranslator(locale: UiCopyLocale) {
  return createTranslator({
    locale,
    messages: {
      savedClinics: locale === 'de' ? germanMessages.website.savedClinics : englishMessages.website.savedClinics,
    },
    namespace: 'savedClinics',
  })
}

const savedClinicsTranslators = {
  de: createSavedClinicsTranslator('de'),
  en: createSavedClinicsTranslator('en'),
}

export function getSavedClinicsTranslator(locale: UiCopyLocale) {
  return savedClinicsTranslators[locale]
}
