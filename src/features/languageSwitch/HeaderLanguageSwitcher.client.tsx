'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { PublicLanguageSwitcher } from '@/components/molecules/PublicLanguageSwitcher'
import { isAuthConfirmationPath, uiCopyLocaleFromPath, type UiCopyLocale } from '@/i18n/requestLocale'
import { DEFAULT_CONTENT_LOCALE } from '@/utilities/contentLocalization'

import type { languageSwitcherCopy } from './copy'
import { useActiveLanguageSwitchRoute } from './LanguageSwitchRouteProvider.client'

const languages: UiCopyLocale[] = ['de', 'en']

export function HeaderLanguageSwitcher({ copyByLocale }: { copyByLocale: typeof languageSwitcherCopy }) {
  const pathname = usePathname()
  const router = useRouter()
  const route = useActiveLanguageSwitchRoute()
  if (!pathname) return null
  if (!route && (isAuthConfirmationPath(pathname) || pathname === '/admin' || pathname.startsWith('/admin/'))) {
    return null
  }

  const locale = route?.locale ?? uiCopyLocaleFromPath(pathname) ?? DEFAULT_CONTENT_LOCALE
  const copy = copyByLocale[locale]

  return (
    <PublicLanguageSwitcher
      key={pathname}
      locale={locale}
      label={copy.label}
      options={languages.map((language) => ({
        locale: language,
        name: copyByLocale[language].name,
        unavailable: copyByLocale[language].unavailable,
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
