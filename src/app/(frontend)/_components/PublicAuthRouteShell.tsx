import type { ReactNode } from 'react'

import { cn } from '@/utilities/ui'

type PublicAuthRouteShellProps = {
  children: ReactNode
  className?: string
}

export const PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME = 'px-0 py-4 sm:px-0 sm:py-6 md:py-8'

export function PublicAuthRouteShell({ children, className }: PublicAuthRouteShellProps) {
  return (
    <section
      className={cn(
        'px-5 pt-4 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] sm:px-6 sm:pt-5 sm:pb-[calc(env(safe-area-inset-bottom)+5rem)] md:px-8 md:pt-8 md:pb-16',
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-5xl justify-center">{children}</div>
    </section>
  )
}
