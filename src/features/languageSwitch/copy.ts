import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { createTranslator } from 'next-intl'

import { getPublicErrorCopy } from '@/features/uiCopy/publicErrors'
import type { UiCopyLocale } from '@/i18n/requestLocale'

function getLanguageSwitcherCopy(locale: UiCopyLocale) {
  const translate = createTranslator({
    locale,
    messages: locale === 'de' ? germanMessages : englishMessages,
    namespace: 'website.languageSwitch',
  })

  return {
    label: translate('label'),
    name: translate(locale === 'de' ? 'german' : 'english'),
    unavailable: getPublicErrorCopy(locale).languageUnavailable,
    confirmTitle: translate('confirmTitle'),
    confirmDescription: translate('confirmDescription'),
    stay: translate('stay'),
    confirmSwitch: translate(locale === 'de' ? 'switchToEnglish' : 'switchToGerman'),
    close: translate('close'),
  }
}

export const languageSwitcherCopy = {
  de: getLanguageSwitcherCopy('de'),
  en: getLanguageSwitcherCopy('en'),
}
