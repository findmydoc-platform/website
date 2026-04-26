'use client'

import { Cookie } from 'lucide-react'

import { Button } from '@/components/atoms/button'

type CookieConsentLauncherProps = {
  label: string
  onOpenSettings: () => void
}

export function CookieConsentLauncher({ label, onOpenSettings }: CookieConsentLauncherProps) {
  return (
    <div className="fixed right-4 [bottom:calc(env(safe-area-inset-bottom)+1rem)] z-50 sm:right-6 sm:[bottom:calc(env(safe-area-inset-bottom)+1.5rem)]">
      <Button
        type="button"
        variant="outline"
        size="clear"
        aria-label={label}
        className="group inline-flex h-12 w-12 items-center justify-start overflow-hidden rounded-full border border-border/80 bg-background/95 px-3 text-sm font-medium shadow-lg backdrop-blur-md transition-[width,box-shadow,background-color] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:w-[9.75rem] focus-visible:w-[9.75rem] sm:hover:w-[10.25rem] sm:focus-visible:w-[10.25rem]"
        onClick={onOpenSettings}
      >
        <Cookie className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="pointer-events-none max-w-0 translate-x-2 overflow-hidden pl-0 text-left leading-none whitespace-nowrap opacity-0 transition-[max-width,opacity,transform,padding-left] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:max-w-[9rem] group-hover:translate-x-0 group-hover:pl-2 group-hover:opacity-100 group-focus-visible:max-w-[9rem] group-focus-visible:translate-x-0 group-focus-visible:pl-2 group-focus-visible:opacity-100 motion-reduce:transition-none">
          {label}
        </span>
      </Button>
    </div>
  )
}
