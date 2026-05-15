import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, within } from '@storybook/test'

import { FavoriteClinicButton } from '@/features/favorites/FavoriteClinicButton'

const meta = {
  title: 'Domain/Patient/Organisms/FavoriteClinicButton',
  component: FavoriteClinicButton,
  args: {
    clinicId: 1001,
    isPatient: false,
    loginHref: '/login/patient?next=%2Fclinics%2Fberlin-health-clinic',
  },
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Patient-facing control for saving or removing clinics from the favorites collection.',
      },
    },
  },
  tags: ['autodocs', 'domain:patient', 'layer:organism', 'status:stable', 'used-in:route:/clinics/[slug]'],
} satisfies Meta<typeof FavoriteClinicButton>

export default meta

type Story = StoryObj<typeof meta>

export const GuestLoginCta: Story = {
  args: {
    isPatient: false,
    unsavedLabel: 'Save clinic',
    variant: 'hero',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Save clinic' })).toHaveAttribute(
      'href',
      '/login/patient?next=%2Fclinics%2Fberlin-health-clinic',
    )
  },
}

export const PatientSaved: Story = {
  args: {
    isPatient: true,
    initialFavoriteId: 42,
    variant: 'compact',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const ListingIconSaved: Story = {
  args: {
    isPatient: true,
    initialFavoriteId: 42,
    variant: 'icon',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('button', { name: 'Saved' })).toHaveAttribute('aria-pressed', 'true')
  },
}

export const ListRemove: Story = {
  args: {
    buttonAriaLabel: 'Remove Berlin University Hospital from saved clinics',
    initialFavoriteId: 42,
    isPatient: true,
    pendingAriaLabel: 'Removing Berlin University Hospital from saved clinics',
    pendingLabel: 'Removing...',
    savedLabel: 'Remove',
    showIcon: false,
    variant: 'list',
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const button = canvas.getByRole('button', { name: 'Remove Berlin University Hospital from saved clinics' })

    await expect(button).toHaveAttribute('aria-pressed', 'true')
    await expect(button).toHaveTextContent('Remove')
  },
}
