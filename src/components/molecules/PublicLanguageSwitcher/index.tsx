'use client'

import { Check, ChevronDown } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/atoms/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/atoms/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover'

type LanguageOption = {
  locale: string
  name: string
  unavailable: string
  href?: string
}

type PublicLanguageSwitcherProps = {
  locale: string
  label: string
  options: LanguageOption[]
  confirmation: {
    title: string
    description: string
    stay: string
    confirm: string
    close: string
  }
  requiresConfirmation?: () => boolean
  onConfirm: (href: string) => void
  renderLink: (option: LanguageOption & { href: string }, shouldNavigate: () => boolean) => ReactNode
}

export function PublicLanguageSwitcher({
  locale,
  label,
  options,
  confirmation,
  requiresConfirmation,
  onConfirm,
  renderLink,
}: PublicLanguageSwitcherProps) {
  const [open, setOpen] = useState(false)
  const [pendingHref, setPendingHref] = useState<string | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const optionsPanel = useRef<HTMLDivElement>(null)
  const stay = useRef<HTMLButtonElement>(null)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={trigger}
            type="button"
            lang={locale}
            variant="ghost"
            hoverEffect="none"
            aria-label={`${label}, ${locale.toUpperCase()}`}
            className="min-h-11 min-w-11 gap-0.5 px-1 font-bold text-foreground sm:gap-1 sm:px-2"
          >
            {locale.toUpperCase()}
            <ChevronDown aria-hidden className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          ref={optionsPanel}
          aria-label={label}
          lang={locale}
          align="center"
          sideOffset={8}
          className="max-h-[var(--radix-popover-content-available-height)] w-48 max-w-[var(--radix-popover-content-available-width)] overflow-y-auto p-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
          onOpenAutoFocus={(event) => {
            const panel = optionsPanel.current
            if (!panel) return

            event.preventDefault()
            const initialFocus = panel.querySelector<HTMLAnchorElement>('a[href]') ?? panel
            initialFocus.focus()
          }}
          onCloseAutoFocus={(event) => {
            if (pendingHref) event.preventDefault()
          }}
        >
          <ul aria-live="polite">
            {options.map((option) => (
              <li key={option.locale} lang={option.locale} aria-current={option.locale === locale ? true : undefined}>
                {option.locale === locale ? (
                  <span className="flex min-h-11 items-center justify-between gap-2 rounded-sm px-3 text-sm font-semibold">
                    {option.name}
                    <Check aria-hidden className="size-4" />
                  </span>
                ) : option.href ? (
                  renderLink({ ...option, href: option.href }, () => {
                    setOpen(false)
                    if (!requiresConfirmation?.()) return true

                    setPendingHref(option.href ?? null)
                    return false
                  })
                ) : (
                  <div className="px-3 py-2 text-sm">
                    <p className="font-medium">{option.name}</p>
                    <p className="mt-1 text-xs leading-5">{option.unavailable}</p>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>
      <Dialog open={pendingHref !== null} onOpenChange={(nextOpen) => !nextOpen && setPendingHref(null)}>
        <DialogContent
          lang={locale}
          closeLabel={confirmation.close}
          className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-lg"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            stay.current?.focus()
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        >
          <DialogHeader className="pr-8 text-left">
            <DialogTitle>{confirmation.title}</DialogTitle>
            <DialogDescription>{confirmation.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button
              ref={stay}
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setPendingHref(null)}
            >
              {confirmation.stay}
            </Button>
            <Button
              type="button"
              className="min-h-11"
              onClick={() => {
                if (!pendingHref) return
                onConfirm(pendingHref)
                setPendingHref(null)
              }}
            >
              {confirmation.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
