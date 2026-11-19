import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import englishMessages from '@findmydoc-platform/ui-copy/en.json'
import { getRequestConfig } from 'next-intl/server'
import { headers } from 'next/headers'

import { patientLoginLocaleFromHeaders } from '@/i18n/requestLocale'

export default getRequestConfig(async () => {
  const locale = patientLoginLocaleFromHeaders(await headers())
  return { locale, messages: locale === 'de' ? germanMessages : englishMessages }
})
