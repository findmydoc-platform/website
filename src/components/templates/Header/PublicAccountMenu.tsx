'use client'

import Link from 'next/link'
import {
  CircleHelp,
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

export type PublicAccountMenuLinks = {
  clinicPartner: string
  dashboard: string
  favorites: string
  help: string
  login: string
  profile: string
  registerPatient: string
  signOut: string
}

export const DEFAULT_PUBLIC_ACCOUNT_MENU_LINKS: PublicAccountMenuLinks = {
  clinicPartner: '/partners/clinics',
  dashboard: '/patient/dashboard',
  favorites: '/patient/favorites',
  help: '/contact',
  login: '/login/patient',
  profile: '/patient/profile',
  registerPatient: '/register/patient',
  signOut: '/admin/logout',
}

type PublicAccountMenuProps = {
  className?: string
  links?: Partial<PublicAccountMenuLinks>
  state: PublicAccountMenuState
}

type AccountMenuLinkItemProps = {
  className?: string
  href: string
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

const AccountMenuLinkItem = ({ className, href, icon: Icon, label }: AccountMenuLinkItemProps) => (
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

const GuestTrigger = React.forwardRef<HTMLButtonElement, AccountTriggerButtonProps>(({ className, ...props }, ref) => (
  <Button
    ref={ref}
    type="button"
    variant="outline"
    className={cn('h-11 gap-2 rounded-full px-3 font-semibold text-foreground sm:px-4', className)}
    aria-label="Open account menu"
    {...props}
  >
    <CircleUserRound aria-hidden className="size-4 shrink-0" />
    <span className="hidden sm:inline">Sign in</span>
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
    className={cn('size-10 rounded-full border-0 bg-transparent p-0 hover:bg-card', className)}
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

const GuestMenuContent = ({ links }: { links: PublicAccountMenuLinks }) => (
  <>
    <DropdownMenuLabel className="px-2 py-2">
      <span className="block text-sm font-semibold text-foreground">Patient account</span>
      <span className="block text-xs font-normal text-muted-foreground">Sign in or create an account.</span>
    </DropdownMenuLabel>
    <DropdownMenuGroup>
      <AccountMenuLinkItem href={links.login} icon={LogIn} label="Patient login" />
      <AccountMenuLinkItem href={links.registerPatient} icon={UserPlus} label="Create patient account" />
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <AccountMenuLinkItem href={links.clinicPartner} icon={Hospital} label="For clinics" />
      <AccountMenuLinkItem href={links.help} icon={CircleHelp} label="Help" />
    </DropdownMenuGroup>
  </>
)

const PatientMenuContent = ({
  links,
  state,
}: {
  links: PublicAccountMenuLinks
  state: Extract<PublicAccountMenuState, { kind: 'patient' }>
}) => (
  <>
    <DropdownMenuLabel className="max-w-72 px-3 py-3 font-normal">
      <span className="block min-w-0">
        <span className="block truncate text-sm font-semibold text-foreground">{state.displayName}</span>
        {state.email ? (
          <span className="block truncate pt-0.5 text-xs text-muted-foreground">{state.email}</span>
        ) : null}
      </span>
    </DropdownMenuLabel>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <AccountMenuLinkItem href={links.dashboard} icon={LayoutDashboard} label="Patient dashboard" />
      <AccountMenuLinkItem href={links.profile} icon={UserRound} label="Profile" />
      <AccountMenuLinkItem href={links.favorites} icon={Heart} label="Favorites" />
    </DropdownMenuGroup>
    <DropdownMenuSeparator />
    <DropdownMenuGroup>
      <AccountMenuLinkItem href={links.help} icon={CircleHelp} label="Help" />
      <AccountMenuLinkItem
        href={links.signOut}
        icon={LogOut}
        label="Sign out"
        className="!text-destructive hover:!text-destructive focus:!text-destructive active:!text-destructive [&_svg]:text-destructive focus:[&_svg]:text-destructive"
      />
    </DropdownMenuGroup>
  </>
)

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
