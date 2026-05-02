import Link from 'next/link'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fireEvent, screen, userEvent, waitFor, within } from '@storybook/test'

import { Container } from '@/components/molecules/Container'
import { Logo } from '@/components/molecules/Logo/Logo'
import { HeaderNav } from '@/components/templates/Header/Nav'
import {
  PublicAccountMenu,
  type PublicAccountMenuLinks,
  type PublicAccountMenuState,
} from '@/components/templates/Header/PublicAccountMenu'
import { normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'

import { getStoryImageSrc, storyPortraits } from '../fixtures/assets'
import { withMockRouter } from '../utils/routerDecorator'
import { withViewportStory } from '../utils/viewportMatrix'
import { headerDataWithSubmenus } from './fixtures'

const navItemsWithSubs = normalizeHeaderNavItems(headerDataWithSubmenus)

const patientState: PublicAccountMenuState = {
  avatarUrl: getStoryImageSrc(storyPortraits.accountMenuAvatar),
  displayName: 'Mina Patel',
  email: 'mina.patel@example.com',
  kind: 'patient',
}

const patientFallbackState: PublicAccountMenuState = {
  displayName: 'Mina Patel',
  email: 'mina.patel@example.com',
  kind: 'patient',
}

const longPatientState: PublicAccountMenuState = {
  displayName: 'Dr. Alexandra Marie von Hohenberg-Schmidt',
  email: 'alexandra.marie.von.hohenberg-schmidt@example-healthmail.com',
  kind: 'patient',
}

const livePatientLinks: Partial<PublicAccountMenuLinks> = {
  dashboard: null,
  favorites: null,
  profile: null,
  signOut: '/logout',
}

const HeaderAccountPreview = ({
  links,
  state,
}: {
  links?: Partial<PublicAccountMenuLinks>
  state: PublicAccountMenuState
}) => (
  <header className="relative z-40 bg-white [--site-header-height:4.5rem] sm:[--site-header-height:5rem]">
    <Container className="flex items-center justify-between gap-3 px-3 py-3 min-[375px]:px-6 sm:py-4">
      <Link href="/" className="shrink-0">
        <Logo loading="eager" priority="high" className="h-9 min-[375px]:h-10 sm:h-14" />
      </Link>
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3 [&_button]:shrink-0">
        <HeaderNav navItems={navItemsWithSubs} />
        <PublicAccountMenu links={links} state={state} />
      </div>
    </Container>
  </header>
)

const meta = {
  title: 'Shared/Templates/PublicAccountMenu',
  component: PublicAccountMenu,
  decorators: [withMockRouter],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Public account menu pattern for guest and patient states. The component remains presentation-only and is now consumed by the production public header via a server-side auth adapter.',
      },
    },
  },
  tags: ['autodocs', 'domain:shared', 'layer:template', 'status:experimental', 'used-in:shared'],
} satisfies Meta<typeof PublicAccountMenu>

export default meta

type Story = StoryObj<typeof meta>

const openAccountMenu = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)

  await userEvent.click(canvas.getByRole('button', { name: /open account menu/i }))
  await expect(screen.getByRole('menu')).toBeVisible()
}

const openAccountMenuWithKeyboard = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement)
  const trigger = canvas.getByRole('button', { name: /open account menu/i })

  trigger.focus()
  await userEvent.keyboard('{Enter}')
  await expect(screen.getByRole('menu')).toBeVisible()
}

const closeAccountMenuWithEscape = async () => {
  await userEvent.keyboard('{Escape}')
  await waitFor(() => {
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
}

const closeAccountMenuWithOutsideClick = async (canvasElement: HTMLElement) => {
  fireEvent.pointerDown(canvasElement)
  await waitFor(() => {
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
}

const verifyGuestMenuItems = async () => {
  await expect(screen.getByRole('menuitem', { name: 'Patient login' })).toHaveAttribute('href', '/login/patient')
  await expect(screen.getByRole('menuitem', { name: 'Create patient account' })).toHaveAttribute(
    'href',
    '/register/patient',
  )
  await expect(screen.getByRole('menuitem', { name: 'For clinics' })).toHaveAttribute('href', '/partners/clinics')
  await expect(screen.getByRole('menuitem', { name: 'Help' })).toHaveAttribute('href', '/contact')
}

const verifyPatientMenuItems = async () => {
  await expect(screen.getByRole('menuitem', { name: 'Patient dashboard' })).toHaveAttribute(
    'href',
    '/patient/dashboard',
  )
  await expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/patient/profile')
  await expect(screen.getByRole('menuitem', { name: 'Favorites' })).toHaveAttribute('href', '/patient/favorites')
  await expect(screen.getByRole('menuitem', { name: 'Help' })).toHaveAttribute('href', '/contact')
  const signOutItem = screen.getByRole('menuitem', { name: 'Sign out' })
  await expect(signOutItem).toHaveAttribute('href', '/logout')
  await expect(screen.getAllByRole('menuitem').at(-1)).toHaveTextContent('Sign out')
}

const verifyLivePatientMenuItems = async () => {
  await expect(screen.queryByRole('menuitem', { name: 'Patient dashboard' })).not.toBeInTheDocument()
  await expect(screen.queryByRole('menuitem', { name: 'Profile' })).not.toBeInTheDocument()
  await expect(screen.queryByRole('menuitem', { name: 'Favorites' })).not.toBeInTheDocument()
  await expect(screen.getByRole('menuitem', { name: 'Help' })).toHaveAttribute('href', '/contact')
  const signOutItem = screen.getByRole('menuitem', { name: 'Sign out' })
  await expect(signOutItem).toHaveAttribute('href', '/logout')
  await expect(screen.getAllByRole('menuitem').at(-1)).toHaveTextContent('Sign out')
}

export const Guest: Story = {
  args: {
    state: { kind: 'guest' },
  },
  play: async ({ canvasElement }) => {
    await openAccountMenuWithKeyboard(canvasElement)
    await verifyGuestMenuItems()
    await closeAccountMenuWithEscape()
  },
}

export const DefaultLoggedOut: Story = {
  args: {
    state: { kind: 'guest' },
  },
  play: async ({ canvasElement }) => {
    await openAccountMenu(canvasElement)
    await verifyGuestMenuItems()
    await closeAccountMenuWithEscape()
  },
}

export const PatientWithAvatarFallback: Story = {
  args: {
    state: patientFallbackState,
  },
  play: async ({ canvasElement }) => {
    await openAccountMenu(canvasElement)
    await expect(screen.getAllByText('Mina Patel').length).toBeGreaterThan(0)
    await verifyPatientMenuItems()
    await closeAccountMenuWithEscape()
  },
}

export const DefaultLoggedIn: Story = {
  args: {
    state: patientState,
  },
  play: async ({ canvasElement }) => {
    await openAccountMenu(canvasElement)
    await expect(screen.getAllByText('Mina Patel').length).toBeGreaterThan(0)
    await verifyPatientMenuItems()
    await closeAccountMenuWithEscape()
  },
}

export const DefaultLoggedInLiveV1: Story = {
  args: {
    links: livePatientLinks,
    state: patientState,
  },
  play: async ({ canvasElement }) => {
    await openAccountMenu(canvasElement)
    await expect(screen.getAllByText('Mina Patel').length).toBeGreaterThan(0)
    await verifyLivePatientMenuItems()
    await closeAccountMenuWithEscape()
  },
}

export const PatientLongIdentity: Story = {
  args: {
    state: longPatientState,
  },
  play: async ({ canvasElement }) => {
    await openAccountMenu(canvasElement)
    await expect(screen.getAllByText('Dr. Alexandra Marie von Hohenberg-Schmidt').length).toBeGreaterThan(0)
    await verifyPatientMenuItems()
    await closeAccountMenuWithEscape()
  },
}

export const SignedOutMenuActions: Story = {
  args: {
    state: { kind: 'guest' },
  },
  play: async ({ canvasElement }) => {
    await openAccountMenu(canvasElement)
    await verifyGuestMenuItems()

    await closeAccountMenuWithOutsideClick(canvasElement)
  },
}

export const ComposedHeaderGuest: Story = {
  args: {
    state: { kind: 'guest' },
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <HeaderAccountPreview state={{ kind: 'guest' }} />,
  play: async ({ canvasElement }) => {
    await openAccountMenu(canvasElement)
    await verifyGuestMenuItems()
    await closeAccountMenuWithEscape()
  },
}

export const ComposedHeaderPatient: Story = {
  args: {
    state: patientState,
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <HeaderAccountPreview state={patientState} />,
  play: async ({ canvasElement }) => {
    await openAccountMenu(canvasElement)
    await verifyPatientMenuItems()
    await closeAccountMenuWithEscape()
  },
}

export const ComposedHeaderPatientLiveV1: Story = {
  args: {
    links: livePatientLinks,
    state: patientState,
  },
  parameters: {
    layout: 'fullscreen',
  },
  render: () => <HeaderAccountPreview links={livePatientLinks} state={patientState} />,
  play: async ({ canvasElement }) => {
    await openAccountMenu(canvasElement)
    await verifyLivePatientMenuItems()
    await closeAccountMenuWithEscape()
  },
}

export const ComposedHeaderGuest320: Story = withViewportStory(ComposedHeaderGuest, 'public320', 'Header guest / 320')
export const ComposedHeaderGuest375: Story = withViewportStory(ComposedHeaderGuest, 'public375', 'Header guest / 375')
export const ComposedHeaderGuest640: Story = withViewportStory(ComposedHeaderGuest, 'public640', 'Header guest / 640')
export const ComposedHeaderGuest768: Story = withViewportStory(ComposedHeaderGuest, 'public768', 'Header guest / 768')
export const ComposedHeaderGuest1024: Story = withViewportStory(
  ComposedHeaderGuest,
  'public1024',
  'Header guest / 1024',
)
export const ComposedHeaderGuest1280: Story = withViewportStory(
  ComposedHeaderGuest,
  'public1280',
  'Header guest / 1280',
)
export const ComposedHeaderGuest320Short: Story = withViewportStory(
  ComposedHeaderGuest,
  'public320Short',
  'Header guest / 320 short',
)
export const ComposedHeaderGuest375Short: Story = withViewportStory(
  ComposedHeaderGuest,
  'public375Short',
  'Header guest / 375 short',
)

export const ComposedHeaderPatient320: Story = withViewportStory(
  ComposedHeaderPatient,
  'public320',
  'Header patient / 320',
)
export const ComposedHeaderPatient375: Story = withViewportStory(
  ComposedHeaderPatient,
  'public375',
  'Header patient / 375',
)
export const ComposedHeaderPatient640: Story = withViewportStory(
  ComposedHeaderPatient,
  'public640',
  'Header patient / 640',
)
export const ComposedHeaderPatient768: Story = withViewportStory(
  ComposedHeaderPatient,
  'public768',
  'Header patient / 768',
)
export const ComposedHeaderPatient1024: Story = withViewportStory(
  ComposedHeaderPatient,
  'public1024',
  'Header patient / 1024',
)
export const ComposedHeaderPatient1280: Story = withViewportStory(
  ComposedHeaderPatient,
  'public1280',
  'Header patient / 1280',
)
export const ComposedHeaderPatient320Short: Story = withViewportStory(
  ComposedHeaderPatient,
  'public320Short',
  'Header patient / 320 short',
)
export const ComposedHeaderPatient375Short: Story = withViewportStory(
  ComposedHeaderPatient,
  'public375Short',
  'Header patient / 375 short',
)
