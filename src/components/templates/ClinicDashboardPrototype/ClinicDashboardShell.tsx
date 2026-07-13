'use client'

import { Button } from '@/components/atoms/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/atoms/dialog'
import { Logo } from '@/components/molecules/Logo/Logo'
import { cn } from '@/utilities/ui'
import { Bell, Building2, Headphones, LayoutDashboard, LogOut, Menu, MessageSquare, Star } from 'lucide-react'
import Image from 'next/image'
import { type ReactNode, useRef, useState } from 'react'

import type { ClinicDashboardAction, ClinicDashboardSection, ClinicDashboardShellData } from './types'

const navigationItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'messages', label: 'Nachrichten', icon: MessageSquare },
  { id: 'reviews', label: 'Bewertungen', icon: Star },
  { id: 'profile', label: 'Klinikprofil', icon: Building2 },
] satisfies ReadonlyArray<{
  id: ClinicDashboardSection
  label: string
  icon: typeof LayoutDashboard
}>

type ClinicDashboardShellProps = {
  activeSection: ClinicDashboardSection
  children: ReactNode
  data: ClinicDashboardShellData
  headerActions?: ReactNode
  headerLabel?: ReactNode
  mobileNavigationOpen?: boolean
  onAction?: (action: ClinicDashboardAction) => void
  onMobileNavigationOpenChange?: (open: boolean) => void
  contentClassName?: string
}

function NavigationItems({
  activeSection,
  compact = false,
  onAction,
  onSelect,
}: {
  activeSection: ClinicDashboardSection
  compact?: boolean
  onAction?: (action: ClinicDashboardAction) => void
  onSelect?: () => void
}) {
  return (
    <nav aria-label="Klinikverwaltung" className="flex flex-col gap-2">
      {navigationItems.map(({ id, label, icon: Icon }) => {
        const active = activeSection === id
        return (
          <Button
            key={id}
            aria-current={active ? 'page' : undefined}
            aria-label={compact ? label : undefined}
            className={cn(
              'h-11 w-full justify-start gap-3 px-3 font-bold',
              compact && 'justify-center px-0 lg:justify-start lg:px-3',
              active
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'text-foreground/70 hover:bg-muted hover:text-foreground',
            )}
            hoverEffect="none"
            onClick={() => {
              onAction?.(`navigate-${id}`)
              onSelect?.()
            }}
            variant="ghost"
          >
            <Icon aria-hidden="true" className="size-5 shrink-0" />
            <span className={cn(compact && 'sr-only lg:not-sr-only')}>{label}</span>
          </Button>
        )
      })}
    </nav>
  )
}

function Sidebar({
  activeSection,
  onAction,
}: {
  activeSection: ClinicDashboardSection
  onAction?: (action: ClinicDashboardAction) => void
}) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r bg-card p-4 md:flex lg:w-64">
      <div className="mb-8 flex min-h-14 items-center justify-center lg:justify-start">
        <Logo className="h-10 w-auto" loading="eager" priority="high" />
        <span className="sr-only lg:not-sr-only lg:ml-2 lg:text-xs lg:font-bold lg:text-foreground/70">
          Admin Bereich
        </span>
      </div>
      <NavigationItems activeSection={activeSection} compact onAction={onAction} />
      <div className="mt-auto space-y-2 border-t pt-4">
        <Button
          aria-label="Support kontaktieren"
          className="h-11 w-full justify-center gap-3 px-0 text-primary lg:justify-start lg:px-3"
          onClick={() => onAction?.('contact-support')}
          variant="ghost"
        >
          <Headphones aria-hidden="true" className="size-5 shrink-0" />
          <span className="sr-only lg:not-sr-only">Support kontaktieren</span>
        </Button>
        <Button
          aria-label="Abmelden"
          className="h-11 w-full justify-center gap-3 px-0 text-foreground/70 lg:justify-start lg:px-3"
          onClick={() => onAction?.('sign-out')}
          variant="ghost"
        >
          <LogOut aria-hidden="true" className="size-5 shrink-0" />
          <span className="sr-only lg:not-sr-only">Abmelden</span>
        </Button>
      </div>
    </aside>
  )
}

export function ClinicDashboardShell({
  activeSection,
  children,
  contentClassName,
  data,
  headerActions,
  headerLabel,
  mobileNavigationOpen,
  onAction,
  onMobileNavigationOpenChange,
}: ClinicDashboardShellProps) {
  const [internalNavigationOpen, setInternalNavigationOpen] = useState(false)
  const navigationTriggerRef = useRef<HTMLButtonElement>(null)
  const resolvedNavigationOpen = mobileNavigationOpen ?? internalNavigationOpen
  const setNavigationOpen = onMobileNavigationOpenChange ?? setInternalNavigationOpen
  const updateNavigationOpen = (open: boolean) => {
    setNavigationOpen(open)
    if (!open) requestAnimationFrame(() => navigationTriggerRef.current?.focus())
  }

  return (
    <div className="min-h-svh bg-muted/55 text-foreground">
      <Sidebar activeSection={activeSection} onAction={onAction} />

      <Dialog open={resolvedNavigationOpen} onOpenChange={updateNavigationOpen}>
        <DialogContent
          className="top-0 left-0 h-svh max-w-72 translate-x-0 translate-y-0 content-start overflow-y-auto overscroll-contain rounded-none border-y-0 border-l-0 p-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] md:hidden"
          overlayClassName="bg-backdrop/70"
        >
          <DialogTitle className="sr-only">Kliniknavigation</DialogTitle>
          <DialogDescription className="sr-only">Bereiche der Klinikverwaltung auswählen.</DialogDescription>
          <Logo className="mb-7 h-10 w-auto" loading="eager" priority="high" />
          <NavigationItems
            activeSection={activeSection}
            onAction={onAction}
            onSelect={() => updateNavigationOpen(false)}
          />
          <div className="mt-auto space-y-2 border-t pt-4">
            <Button
              className="w-full justify-start gap-3"
              onClick={() => onAction?.('contact-support')}
              variant="ghost"
            >
              <Headphones aria-hidden="true" className="size-5" />
              Support kontaktieren
            </Button>
            <Button className="w-full justify-start gap-3" onClick={() => onAction?.('sign-out')} variant="ghost">
              <LogOut aria-hidden="true" className="size-5" />
              Abmelden
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="md:pl-20 lg:pl-64">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b bg-card/95 px-4 py-2 backdrop-blur-sm sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              aria-expanded={resolvedNavigationOpen}
              aria-haspopup="dialog"
              aria-label="Navigation öffnen"
              className="size-10 shrink-0 md:hidden"
              onClick={() => {
                onAction?.('open-mobile-navigation')
                updateNavigationOpen(true)
              }}
              ref={navigationTriggerRef}
              size="icon"
              variant="ghost"
            >
              <Menu aria-hidden="true" className="size-5" />
            </Button>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold sm:text-base">{headerLabel ?? data.clinicName}</div>
              <div className="truncate text-xs text-foreground/70 lg:hidden">Admin Bereich</div>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            {headerActions ? <div className="hidden min-w-0 items-center gap-2 sm:flex">{headerActions}</div> : null}
            <Button
              aria-label="Benachrichtigungen"
              className="relative size-10 shrink-0"
              onClick={() => onAction?.('open-notifications')}
              size="icon"
              variant="ghost"
            >
              <Bell aria-hidden="true" className="size-5" />
              <span aria-hidden="true" className="absolute top-2 right-2 size-2 rounded-full bg-destructive" />
            </Button>
            <div className="flex shrink-0 items-center gap-2">
              <Image
                alt={data.adminAvatar.alt}
                className="size-9 rounded-full border object-cover"
                height={36}
                src={data.adminAvatar.src}
                width={36}
              />
              <span className="hidden text-sm font-bold xl:inline">{data.adminName}</span>
            </div>
          </div>
        </header>

        {headerActions ? <div className="border-b bg-card px-4 py-3 sm:hidden">{headerActions}</div> : null}

        <main className={cn('container-content p-4 sm:p-6 lg:p-8', contentClassName)}>{children}</main>
      </div>
    </div>
  )
}
