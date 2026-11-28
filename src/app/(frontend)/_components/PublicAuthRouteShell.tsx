import type { ReactNode } from 'react'

import { cn } from '@/utilities/ui'
import { CookieConsentLauncherSlot } from '@/features/cookieConsent/CookieConsentLauncherSlot.client'

type PublicAuthRouteShellProps = {
  children: ReactNode
  className?: string
}

export const PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME = 'p-0 sm:p-0'

export function PublicAuthRouteShell({ children, className }: PublicAuthRouteShellProps) {
  return (
    <>
      <section
        className={cn(
          'bg-site-canvas px-5 pt-6 pb-4 sm:px-6 md:px-8 md:pt-8',
          '[&_.text-muted-foreground]:text-foreground [&_label]:text-start',
          '[&_input:not(:disabled):not([aria-invalid=true])]:border-[color-mix(in_srgb,var(--foreground)_60%,var(--background))]',
          '[&_[data-invalid=true]_[role=alert]]:text-destructive [&_input[aria-invalid=true]]:border-destructive',
          '[&_input]:placeholder:text-foreground/75 [&_input[aria-invalid=true]:focus-visible]:ring-destructive',
          '[&_button[type=submit]]:min-h-11 [&_button[type=submit]]:whitespace-normal',
          className,
        )}
      >
        <div className="mx-auto flex w-full max-w-5xl justify-center">{children}</div>
      </section>
      <CookieConsentLauncherSlot />
    </>
  )
}
