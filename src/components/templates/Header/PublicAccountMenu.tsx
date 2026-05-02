'use client'

import Link from 'next/link'
import {
  CircleUserRound,
  Heart,
  Hospital,
  LayoutDashboard,
  LogIn,
  LogOut,
  UserPlus,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/avatar'
import { Button } from '@/components/atoms/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/atoms/dropdown-menu'
import { cn } from '@/utilities/ui'

export type PublicAccountMenuState =
  | {
      kind: 'guest'
    }
  | {
      avatarUrl?: string
      displayName: string
      email?: string
      kind: 'patient'
    }

export type PublicAccountMenuLinkValue = string | null

export type PublicAccountMenuLinks = {
  clinicPartner: PublicAccountMenuLinkValue
  dashboard: PublicAccountMenuLinkValue
  favorites: PublicAccountMenuLinkValue
  help: PublicAccountMenuLinkValue
  login: PublicAccountMenuLinkValue
  profile: PublicAccountMenuLinkValue
  registerPatient: PublicAccountMenuLinkValue
  signOut: PublicAccountMenuLinkValue
}

export const DEFAULT_PUBLIC_ACCOUNT_MENU_LINKS: PublicAccountMenuLinks = {
  clinicPartner: '/partners/clinics',
  dashboard: '/patient/dashboard',
  favorites: '/patient/favorites',
  help: '/contact',
  login: '/login/patient',
  profile: '/patient/profile',
  registerPatient: '/register/patient',
  signOut: '/logout',
}

type PublicAccountMenuProps = {
  className?: string
  links?: Partial<PublicAccountMenuLinks>
  state: PublicAccountMenuState
}

type AccountMenuLinkItemProps = {
  className?: string
  href?: PublicAccountMenuLinkValue
  icon: LucideIcon
  label: string
}

type AccountTriggerButtonProps = React.ComponentPropsWithoutRef<typeof Button>

const getInitials = (name: string): string => {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  return initials || 'FM'
}

const AccountMenuLinkItem = ({ className, href, icon: Icon, label }: AccountMenuLinkItemProps) => {
  if (!href) return null

  return (
    <DropdownMenuItem
      asChild
      className={cn(
        'min-h-11 !cursor-pointer !text-foreground no-underline hover:!bg-muted/60 hover:!text-foreground focus:!bg-muted/60 focus:!text-foreground active:!text-foreground data-[highlighted]:!bg-muted/60 data-[highlighted]:!text-foreground [&_svg]:text-muted-foreground focus:[&_svg]:text-muted-foreground data-[highlighted]:[&_svg]:text-muted-foreground',
        className,
      )}
    >
      <Link href={href}>
        <Icon aria-hidden />
        <span className="min-w-0 truncate">{label}</span>
      </Link>
    </DropdownMenuItem>
  )
}

type AccountMenuItemConfig = {
  className?: string
  href?: PublicAccountMenuLinkValue
  icon: LucideIcon
  label: string
}

const renderMenuGroup = (items: AccountMenuItemConfig[]) => {
  const visibleItems = items.filter((item) => item.href)
  if (visibleItems.length === 0) return null

  return (
    <DropdownMenuGroup>
      {visibleItems.map((item) => (
        <AccountMenuLinkItem key={item.label} {...item} />
      ))}
    </DropdownMenuGroup>
  )
}

const GuestTrigger = React.forwardRef<HTMLButtonElement, AccountTriggerButtonProps>(({ className, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    hoverEffect="none"
    variant="ghost"
    className={cn(
      'size-11 rounded-md p-0 font-bold text-foreground hover:bg-transparent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-hidden md:size-auto md:gap-2.5 md:rounded-sm md:px-2 md:py-1.5 md:text-base',
      className,
    )}
    aria-label="Open account menu"
    {...props}
  >
    <CircleUserRound aria-hidden className="size-5 shrink-0" />
    <span className="hidden md:inline">Sign in</span>
  </Button>
))
GuestTrigger.displayName = 'GuestTrigger'

const PatientTrigger = React.forwardRef<
  HTMLButtonElement,
  AccountTriggerButtonProps & { state: Extract<PublicAccountMenuState, { kind: 'patient' }> }
>(({ className, state, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant="ghost"
    className={cn(
      'size-10 rounded-full border-0 bg-transparent p-0 hover:bg-card focus-visible:bg-card focus-visible:ring-1 focus-visible:ring-border/70 focus-visible:ring-offset-0',
      className,
    )}
    aria-label="Open account menu"
    {...props}
  >
    <Avatar className="size-9 border border-border bg-muted">
      {state.avatarUrl ? <AvatarImage src={state.avatarUrl} alt={`${state.displayName} profile`} /> : null}
      <AvatarFallback className="text-xs font-semibold text-foreground">
        {getInitials(state.displayName)}
      </AvatarFallback>
    </Avatar>
  </Button>
))
PatientTrigger.displayName = 'PatientTrigger'

const GuestMenuContent = ({ links }: { links: PublicAccountMenuLinks }) => {
  const primaryGroup = renderMenuGroup([
    { href: links.login, icon: LogIn, label: 'Patient login' },
    { href: links.registerPatient, icon: UserPlus, label: 'Create patient account' },
  ])
  const secondaryGroup = renderMenuGroup([{ href: links.clinicPartner, icon: Hospital, label: 'For clinics' }])

  return (
    <>
      <DropdownMenuLabel className="px-2 py-2">
        <span className="block text-sm font-semibold text-foreground">Patient account</span>
        <span className="block text-xs font-normal text-muted-foreground">Sign in or create an account.</span>
      </DropdownMenuLabel>
      {primaryGroup}
      {primaryGroup && secondaryGroup ? <DropdownMenuSeparator /> : null}
      {secondaryGroup}
    </>
  )
}

const PatientMenuContent = ({
  links,
  state,
}: {
  links: PublicAccountMenuLinks
  state: Extract<PublicAccountMenuState, { kind: 'patient' }>
}) => {
  const primaryGroup = renderMenuGroup([
    { href: links.dashboard, icon: LayoutDashboard, label: 'Patient dashboard' },
    { href: links.profile, icon: UserRound, label: 'Profile' },
    { href: links.favorites, icon: Heart, label: 'Favorites' },
  ])
  const secondaryGroup = renderMenuGroup([
    {
      href: links.signOut,
      icon: LogOut,
      label: 'Sign out',
      className:
        '!text-destructive hover:!text-destructive focus:!text-destructive active:!text-destructive [&_svg]:text-destructive focus:[&_svg]:text-destructive',
    },
  ])

  return (
    <>
      <DropdownMenuLabel className="max-w-72 px-3 py-3 font-normal">
        <span className="block min-w-0">
          <span className="block truncate text-sm font-semibold text-foreground">{state.displayName}</span>
          {state.email ? (
            <span className="block truncate pt-0.5 text-xs text-muted-foreground">{state.email}</span>
          ) : null}
        </span>
      </DropdownMenuLabel>
      {primaryGroup || secondaryGroup ? <DropdownMenuSeparator /> : null}
      {primaryGroup}
      {primaryGroup && secondaryGroup ? <DropdownMenuSeparator /> : null}
      {secondaryGroup}
    </>
  )
}

export const PublicAccountMenu = ({ className, links: linkOverrides, state }: PublicAccountMenuProps) => {
  const links = { ...DEFAULT_PUBLIC_ACCOUNT_MENU_LINKS, ...linkOverrides }

  return (
    <div className={cn('flex shrink-0 items-center', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {state.kind === 'guest' ? <GuestTrigger /> : <PatientTrigger state={state} />}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[min(18rem,calc(100vw-2rem))] duration-200 ease-out motion-reduce:duration-0 motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none"
        >
          {state.kind === 'guest' ? (
            <GuestMenuContent links={links} />
          ) : (
            <PatientMenuContent links={links} state={state} />
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
