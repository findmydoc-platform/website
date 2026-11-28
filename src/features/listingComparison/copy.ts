import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'

import type { UiCopyLocale } from '@/i18n/requestLocale'

function createListingComparisonTranslator(locale: UiCopyLocale) {
  return createTranslator({
    locale,
    messages: locale === 'de' ? germanMessages : englishMessages,
    namespace: 'website.listingComparison',
  })
}

const translators = {
  de: createListingComparisonTranslator('de'),
  en: createListingComparisonTranslator('en'),
}

export function getListingComparisonTranslator(locale: UiCopyLocale) {
  return translators[locale]
}
