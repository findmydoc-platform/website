'use client'

import { useState, type ReactNode } from 'react'
import { PublicAuthRouteShell } from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { useLanguageSwitchRoute } from '@/features/languageSwitch/LanguageSwitchRouteProvider.client'
import type { UiCopyLocale } from '@/i18n/requestLocale'

export function RecoveryCompletionShell({ children, locale }: { children: ReactNode; locale: UiCopyLocale }) {
  const [menuOpen, setMenuOpen] = useState(false)
  useLanguageSwitchRoute({ locale, targets: {}, onMenuOpenChange: setMenuOpen })
  return (
    <PublicAuthRouteShell className={menuOpen ? 'pt-30 md:pt-30 xl:pt-8' : undefined}>{children}</PublicAuthRouteShell>
  )
}
