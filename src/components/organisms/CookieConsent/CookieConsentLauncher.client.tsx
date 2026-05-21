'use client'

import { Cookie } from 'lucide-react'

import { Button } from '@/components/atoms/button'

type CookieConsentLauncherProps = {
  compact?: boolean
  label: string
  onOpenSettings: () => void
}

export function CookieConsentLauncher({ compact = false, label, onOpenSettings }: CookieConsentLauncherProps) {
  return (
    <div
      className={
        compact
          ? 'relative z-40 flex justify-end px-3 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] sm:px-6 sm:pb-[calc(env(safe-area-inset-bottom)+1.5rem)]'
          : 'fixed right-3 [bottom:calc(env(safe-area-inset-bottom)+0.875rem)] z-40 sm:right-6 sm:[bottom:calc(env(safe-area-inset-bottom)+1.5rem)]'
      }
    >
      <Button
        type="button"
        variant="outline"
        size="clear"
        aria-label={label}
        className="group inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-border/80 bg-background/95 px-0 text-sm font-medium shadow-lg backdrop-blur-md transition-[width,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] sm:h-12 sm:w-12 sm:justify-start sm:px-3 sm:hover:w-[10.25rem] sm:focus-visible:w-[10.25rem]"
        onClick={onOpenSettings}
      >
        <Cookie className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="pointer-events-none hidden max-w-0 translate-x-2 overflow-hidden pl-0 text-left leading-none whitespace-nowrap opacity-0 transition-[max-width,opacity,transform,padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none sm:inline sm:group-hover:max-w-[9rem] sm:group-hover:translate-x-0 sm:group-hover:pl-2 sm:group-hover:opacity-100 sm:group-focus-visible:max-w-[9rem] sm:group-focus-visible:translate-x-0 sm:group-focus-visible:pl-2 sm:group-focus-visible:opacity-100">
          {label}
        </span>
      </Button>
    </div>
  )
}
