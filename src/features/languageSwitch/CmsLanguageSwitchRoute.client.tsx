'use client'

import type { ContentLocale } from '@/utilities/contentLocalization'

import { useLanguageSwitchRoute, type LanguageSwitchTargets } from './LanguageSwitchRouteProvider.client'

export function CmsLanguageSwitchRoute({ locale, targets }: { locale: ContentLocale; targets: LanguageSwitchTargets }) {
  useLanguageSwitchRoute({ locale, targets })
  return null
}
