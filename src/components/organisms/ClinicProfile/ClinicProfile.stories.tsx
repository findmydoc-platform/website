import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'
import { withViewportStory } from '@/stories/utils/viewportMatrix'
import { ClinicProfile, type ClinicProfileProps } from './ClinicProfile'

const data = {
  ...clinicDetailFixture,
  galleryImages: clinicDetailFixture.galleryImages.slice(0, 5),
  trust: { ...clinicDetailFixture.trust, reviewCount: clinicDetailFixture.reviews.totalCount },
}
const meta = {
  title: 'Domain/Clinic/Organisms/ClinicProfile',
  component: ClinicProfile,
  args: {
    data,
    favorite: { isPatient: true, saved: false, onToggle: () => {}, onSignIn: () => {} },
    share: { url: 'https://example.test/clinic', onCopy: async () => {} },
    map: { allowed: false },
  },
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs', 'domain:clinic', 'layer:organism', 'status:experimental', 'used-in:route:/clinics/[slug]'],
} satisfies Meta<typeof ClinicProfile>
export default meta

type Story = StoryObj<typeof meta>
function ControlledProfile(args: ClinicProfileProps) {
  const [saved, setSaved] = React.useState(args.favorite.saved)
  return <ClinicProfile {...args} favorite={{ ...args.favorite, saved, onToggle: () => setSaved((value) => !value) }} />
}

export const Gallery: Story = {
  render: (args) => <ControlledProfile {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /view all photos/i })
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    const dialog = await within(document.body).findByRole('dialog')
    await expect(dialog).toBeVisible()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Next photo' }))
    await expect(within(dialog).getByText('Photo 2 of 5')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveFocus()
  },
}
export const SaveAndShare: Story = {
  render: (args) => <ControlledProfile {...args} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const save = canvas.getByRole('button', { name: 'Save' })
    await userEvent.click(save)
    await expect(save).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(save)
    await expect(save).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(canvas.getByRole('button', { name: 'Share' }))
    const popup = within(document.body)
    await userEvent.click(popup.getByRole('button', { name: 'Copy link' }))
    await expect(popup.getAllByRole('status').some((status) => status.textContent?.length)).toBe(true)
  },
}
export const NoPhotos: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByRole('button', { name: /view.*photo/i })).not.toBeInTheDocument()
  },
  args: {
    data: {
      ...data,
      galleryImages: [],
      location: {},
      description: '',
      trust: { ratingValue: null, reviewCount: 0, verification: 'unverified', languages: [], accreditations: [] },
    },
  },
}
export const OnePhoto: Story = { args: { data: { ...data, galleryImages: data.galleryImages.slice(0, 1) } } }
export const FailedPhoto: Story = {
  play: async ({ canvasElement }) => {
    await expect(await within(canvasElement).findByRole('img', { name: 'Photo unavailable' })).toBeVisible()
  },
  args: { data: { ...data, galleryImages: [{ id: 'failed', src: '/missing-clinic-photo.jpg', alt: 'Clinic photo' }] } },
}
export const MapAllowed: Story = {
  args: { map: { allowed: true, embedHref: 'about:blank' } },
  play: async ({ canvasElement }) => {
    const trigger = within(canvasElement).getByRole('button', { name: 'View location' })
    await userEvent.click(trigger)
    const dialog = await within(document.body).findByRole('dialog')
    await expect(within(dialog).getByTitle(`Interactive map of ${data.clinicName}`)).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveFocus()
  },
}
export const MapDenied: Story = {
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).queryByTitle(`Map of ${data.clinicName}`)).not.toBeInTheDocument()
  },
}
export const TwoPhotos: Story = { args: { data: { ...data, galleryImages: data.galleryImages.slice(0, 2) } } }
export const ThreePhotos: Story = { args: { data: { ...data, galleryImages: data.galleryImages.slice(0, 3) } } }
export const FourPhotos: Story = { args: { data: { ...data, galleryImages: data.galleryImages.slice(0, 4) } } }
export const Gallery320: Story = withViewportStory(Gallery, 'public320', 'Gallery / 320')
export const Gallery375: Story = withViewportStory(Gallery, 'public375', 'Gallery / 375')
export const Gallery640: Story = withViewportStory(Gallery, 'public640', 'Gallery / 640')
export const Gallery768: Story = withViewportStory(Gallery, 'public768', 'Gallery / 768')
export const Gallery1024: Story = withViewportStory(Gallery, 'public1024', 'Gallery / 1024')
export const Gallery1280: Story = withViewportStory(Gallery, 'public1280', 'Gallery / 1280')
