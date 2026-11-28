import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'

import type { UiCopyLocale } from '@/i18n/requestLocale'

export function getPublicErrorCopy(locale: UiCopyLocale) {
  const t = createTranslator({
    locale,
    messages: locale === 'de' ? germanMessages : englishMessages,
    namespace: 'website.errors',
  })
  return {
    notFound: t('notFound'),
    home: t('home'),
    unexpected: t('unexpected'),
    retry: t('retry'),
    germanAvailable: t('germanAvailable'),
    readGerman: t('readGerman'),
    languageUnavailable: t('languageUnavailable'),
  }
}
