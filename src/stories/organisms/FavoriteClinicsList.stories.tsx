import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, waitFor, within } from '@storybook/test'

import { Container } from '@/components/molecules/Container'
import { Header } from '@/components/templates/Header/Component'
import {
  PublicAccountMenu,
  type PublicAccountMenuLinks,
  type PublicAccountMenuState,
} from '@/components/templates/Header/PublicAccountMenu'
import { FavoriteClinicsList } from '@/features/favorites/FavoriteClinicsList.client'
import type { FavoriteClinicListItem } from '@/features/favorites/server'
import { getStoryImageSrc, storyPortraits } from '@/stories/fixtures/assets'
import { clinicMedia } from '@/stories/fixtures/listings'
import { normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'
import { headerDataWithSubmenus } from '../templates/fixtures'
import { createMockFetchDecorator } from '../utils/fetchDecorator'
import { withViewportStory } from '../utils/viewportMatrix'

const navItems = normalizeHeaderNavItems(headerDataWithSubmenus)

const patientState: PublicAccountMenuState = {
  avatarUrl: getStoryImageSrc(storyPortraits.accountMenuAvatar),
  displayName: 'Mina Patel',
  email: 'mina.patel@example.com',
  kind: 'patient',
}

const patientLinks: Partial<PublicAccountMenuLinks> = {
  dashboard: null,
  favorites: null,
  profile: null,
  signOut: '/logout',
}

const savedClinicItems: FavoriteClinicListItem[] = [
  {
    favoriteId: 1001,
    clinicId: 501,
    name: 'Berlin University Hospital',
    href: '/clinics/berlin-university-hospital',
    location: 'Berlin, Germany',
    media: clinicMedia.consultation,
    verification: {
      variant: 'gold',
    },
    ratingValue: 4.8,
  },
  {
    favoriteId: 1002,
    clinicId: 502,
    name: 'Munich Medical Center',
    href: '/clinics/munich-medical-center',
    location: 'Munich, Germany',
    media: clinicMedia.lobby,
    verification: {
      variant: 'silver',
    },
    ratingValue: 4.6,
  },
  {
    favoriteId: 1003,
    clinicId: 503,
    name: 'Istanbul Ortopedi Merkezi',
    href: '/clinics/istanbul-ortopedi-merkezi',
    location: 'Istanbul, Turkey',
    media: clinicMedia.hospitalCorridor,
    verification: {
      variant: 'bronze',
    },
    ratingValue: 4.7,
  },
]

function PatientFavoritesFrame({ items }: { items: FavoriteClinicListItem[] }) {
  return (
    <>
      <Header
        navItems={navItems}
        rightActions={<PublicAccountMenu links={patientLinks} state={patientState} />}
        showPreviewBadge={false}
      />
      <main className="bg-muted/30 py-8 sm:py-12 lg:py-14">
        <Container>
          <FavoriteClinicsList initialItems={items} />
        </Container>
      </main>
    </>
  )
}

const pendingRemoveFetch: typeof fetch = () => new Promise<Response>(() => {})

const failedRemoveFetch: typeof fetch = async () =>
  new Response(JSON.stringify({ message: 'We could not remove this clinic. Please try again.' }), {
    headers: {
      'Content-Type': 'application/json',
    },
    status: 500,
  })

const meta = {
  title: 'Domain/Patient/Organisms/FavoriteClinicsList',
  component: FavoriteClinicsList,
  args: {
    initialItems: [],
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Patient account surface for reviewing and removing saved clinics.',
      },
    },
  },
  tags: ['autodocs', 'domain:patient', 'layer:organism', 'status:stable', 'used-in:route:/patient/favorites'],
} satisfies Meta<typeof FavoriteClinicsList>

export default meta

type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: {
    initialItems: savedClinicItems,
  },
  render: ({ initialItems }) => <PatientFavoritesFrame items={initialItems} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { level: 1, name: 'Saved clinics' })).toBeInTheDocument()
    await expect(canvas.queryByRole('heading', { name: 'No saved clinics yet' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('list', { name: 'Saved clinics list' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('article')).toHaveLength(3)
    await expect(canvas.getByRole('link', { name: 'View details for Berlin University Hospital' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'View details for Munich Medical Center' })).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'View details for Istanbul Ortopedi Merkezi' })).toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: 'Remove Berlin University Hospital from saved clinics' }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: 'Remove Munich Medical Center from saved clinics' }),
    ).toBeInTheDocument()
    await expect(
      canvas.getByRole('button', { name: 'Remove Istanbul Ortopedi Merkezi from saved clinics' }),
    ).toBeInTheDocument()
    await expect(canvas.getAllByRole('link', { name: 'Browse clinics' })).toHaveLength(1)
    await expect(canvas.getByRole('button', { name: /open account menu/i })).toBeInTheDocument()
    await expect(canvas.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: {
    initialItems: [],
  },
  render: ({ initialItems }) => <PatientFavoritesFrame items={initialItems} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(canvas.getByRole('heading', { level: 1, name: 'Saved clinics' })).toBeInTheDocument()
    await expect(canvas.getByRole('heading', { name: 'No saved clinics yet' })).toBeInTheDocument()
    await expect(canvas.getAllByRole('link', { name: 'Browse clinics' })).toHaveLength(1)
    await expect(canvas.queryByRole('link', { name: 'Details' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('list', { name: 'Saved clinics list' })).not.toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: /open account menu/i })).toBeInTheDocument()
    await expect(canvas.queryByRole('link', { name: 'Sign in' })).not.toBeInTheDocument()
  },
}

export const RemovePending: Story = {
  args: {
    initialItems: [savedClinicItems[0] as FavoriteClinicListItem],
  },
  decorators: [createMockFetchDecorator(pendingRemoveFetch)],
  render: ({ initialItems }) => <PatientFavoritesFrame items={initialItems} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Remove Berlin University Hospital from saved clinics' }))
    await expect(
      canvas.getByRole('button', { name: 'Removing Berlin University Hospital from saved clinics' }),
    ).toBeDisabled()
    await expect(canvas.queryByRole('heading', { name: 'No saved clinics yet' })).not.toBeInTheDocument()
  },
}

export const RemoveError: Story = {
  args: {
    initialItems: [savedClinicItems[0] as FavoriteClinicListItem],
  },
  decorators: [createMockFetchDecorator(failedRemoveFetch)],
  render: ({ initialItems }) => <PatientFavoritesFrame items={initialItems} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await userEvent.click(canvas.getByRole('button', { name: 'Remove Berlin University Hospital from saved clinics' }))
    await waitFor(() =>
      expect(canvas.getByText('We could not remove this clinic. Please try again.')).toBeInTheDocument(),
    )
    await expect(canvas.getByRole('heading', { name: 'Berlin University Hospital' })).toBeInTheDocument()
  },
}

export const Populated320: Story = withViewportStory(Populated, 'public320', 'Populated / 320')
export const Populated375: Story = withViewportStory(Populated, 'public375', 'Populated / 375')
export const Populated640: Story = withViewportStory(Populated, 'public640', 'Populated / 640')
export const Populated768: Story = withViewportStory(Populated, 'public768', 'Populated / 768')
export const Populated1024: Story = withViewportStory(Populated, 'public1024', 'Populated / 1024')
export const Populated1280: Story = withViewportStory(Populated, 'public1280', 'Populated / 1280')
export const Populated320Short: Story = withViewportStory(Populated, 'public320Short', 'Populated / 320 short')
export const Populated375Short: Story = withViewportStory(Populated, 'public375Short', 'Populated / 375 short')
export const Empty320: Story = withViewportStory(Empty, 'public320', 'Empty / 320')
export const Empty375: Story = withViewportStory(Empty, 'public375', 'Empty / 375')
export const Empty640: Story = withViewportStory(Empty, 'public640', 'Empty / 640')
export const Empty768: Story = withViewportStory(Empty, 'public768', 'Empty / 768')
export const Empty1024: Story = withViewportStory(Empty, 'public1024', 'Empty / 1024')
export const Empty1280: Story = withViewportStory(Empty, 'public1280', 'Empty / 1280')
export const Empty320Short: Story = withViewportStory(Empty, 'public320Short', 'Empty / 320 short')
export const Empty375Short: Story = withViewportStory(Empty, 'public375Short', 'Empty / 375 short')
export const RemovePending320: Story = withViewportStory(RemovePending, 'public320', 'Remove pending / 320')
export const RemoveError1280: Story = withViewportStory(RemoveError, 'public1280', 'Remove error / 1280')
