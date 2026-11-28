'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { PublicLanguageSwitcher } from '@/components/molecules/PublicLanguageSwitcher'
import { isAuthConfirmationPath, type UiCopyLocale } from '@/i18n/requestLocale'
import { publicPageLocaleFromPath } from '@/i18n/publicNavigationPath'

import type { languageSwitcherCopy } from './copy'
import { useActiveLanguageSwitchRoute } from './LanguageSwitchRouteProvider.client'

const languages: UiCopyLocale[] = ['de', 'en']

export function HeaderLanguageSwitcher({
  copyByLocale,
  hideWithoutRoute = false,
}: {
  copyByLocale: typeof languageSwitcherCopy
  hideWithoutRoute?: boolean
}) {
  const pathname = usePathname()
  const router = useRouter()
  const route = useActiveLanguageSwitchRoute()
  if (!pathname) return null
  if (
    !route &&
    (hideWithoutRoute || isAuthConfirmationPath(pathname) || pathname === '/admin' || pathname.startsWith('/admin/'))
  ) {
    return null
  }

  const locale = route?.locale ?? publicPageLocaleFromPath(pathname)
  const copy = copyByLocale[locale]

  return (
    <PublicLanguageSwitcher
      key={pathname}
      locale={locale}
      label={copy.label}
      options={languages.map((language) => ({
        locale: language,
        name: copyByLocale[language].name,
        unavailable: copy.unavailable,
        unavailableLocale: locale,
        href: route?.targets[language],
      }))}
      confirmation={{
        title: copy.confirmTitle,
        description: copy.confirmDescription,
        stay: copy.stay,
        confirm: copy.confirmSwitch,
        close: copy.close,
      }}
      requiresConfirmation={route?.requiresConfirmation}
      onMenuOpenChange={route?.onMenuOpenChange}
      onConfirm={(href) => {
        route?.onNavigate?.(href)
        router.push(href)
      }}
      renderLink={({ href, locale: targetLocale, name }, shouldNavigate) => (
        <Link
          href={href}
          hrefLang={targetLocale}
          prefetch={false}
          className="flex min-h-11 items-center rounded-sm px-3 text-sm font-medium text-foreground hover:bg-accent focus-visible:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
          onNavigate={(event) => {
            if (shouldNavigate()) {
              route?.onNavigate?.(href)
            } else {
              event.preventDefault()
            }
          }}
        >
          {name}
        </Link>
      )}
    />
  )
}
