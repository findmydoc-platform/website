import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ClinicContactRequestError, type ClinicDetailData } from '@/features/clinicDetail/contracts'
import type { PatientInquiryCreationContext } from '@/features/patientInquiries/creationContext'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'
import { Header } from '@/components/templates/Header/Component'
import { Footer } from '@/components/templates/Footer/Component'
import { PublicAccountMenu } from '@/components/templates/Header/PublicAccountMenu'
import { headerData, footerData } from '@/stories/templates/fixtures'
import { normalizeHeaderNavItems, normalizeFooterNavGroups } from '@/utilities/normalizeNavItems'
import { ClinicProfileComplete } from './ClinicProfileComplete'

type Scenario = 'guest' | 'signed-in' | 'reauthentication' | 'error' | 'pending'
type Ports = 'default' | 'copy-fails' | 'save-fails' | 'map-allowed'
const storyData: ClinicDetailData = {
  ...clinicDetailFixture,
  doctors: clinicDetailFixture.doctors
    .slice(0, 12)
    .map((doctor) => ({ ...doctor, image: { src: '/images/placeholders/doctor-neutral-placeholder.webp', alt: '' } })),
  trust: { ...clinicDetailFixture.trust, reviewCount: clinicDetailFixture.reviews.totalCount },
}
const guest: PatientInquiryCreationContext = { kind: 'guest' }
const signedIn: PatientInquiryCreationContext = {
  kind: 'authenticated',
  account: { firstName: 'Alex', lastName: 'Patient', email: 'alex@example.test', phoneNumber: '+49 12345678' },
  loginHref: '#',
}
const reauthentication: PatientInquiryCreationContext = { kind: 'reauthentication-required', loginHref: '#' }
function StoryPage({ data, scenario, ports }: { data: ClinicDetailData; scenario: Scenario; ports: Ports }) {
  const [saved, setSaved] = React.useState(false)
  const [saveError, setSaveError] = React.useState('')
  const attempts = React.useRef(0)
  React.useEffect(() => {
    const preventNavigation = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('a')) event.preventDefault()
    }
    document.addEventListener('click', preventNavigation, true)
    return () => document.removeEventListener('click', preventNavigation, true)
  }, [])
  const submit = React.useCallback(async () => {
    attempts.current += 1
    if (scenario === 'pending') return new Promise<{ id: string }>(() => {})
    if (scenario === 'error' && attempts.current === 1)
      throw new ClinicContactRequestError('The simulated request failed. Try again.', false)
    return scenario === 'guest'
      ? { id: 'storybook', preparation: { reference: 'storybook', expiresAt: '2027-01-08T12:00:00Z' } }
      : { id: 'storybook' }
  }, [scenario])
  return (
    <div
      className="bg-site-canvas"
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('a')) event.preventDefault()
      }}
    >
      <div className="bg-muted px-4 py-2 text-center text-sm" role="note">
        Storybook simulation. No inquiry is sent or saved.
      </div>
      <Header
        navItems={normalizeHeaderNavItems(headerData)}
        rightActions={<PublicAccountMenu state={{ kind: 'guest' }} />}
      />
      <ClinicProfileComplete
        data={data}
        inquiryCreation={scenario === 'reauthentication' ? reauthentication : scenario === 'guest' ? guest : signedIn}
        onSubmitContactRequest={submit}
        favorite={{
          isPatient: true,
          saved,
          error: saveError,
          onToggle: () => {
            if (ports === 'save-fails') setSaveError('Saving failed. Please try again.')
            else setSaved((value) => !value)
          },
          onSignIn: () => {},
        }}
        share={{
          url: 'https://example.test/clinic',
          onCopy: async () => {
            if (ports === 'copy-fails') throw new Error('Copy failed')
          },
        }}
        inquiryNotice={
          <p role="note" className="mb-6 rounded-lg bg-muted p-3 text-sm">
            Storybook simulation. No inquiry is sent or saved.
          </p>
        }
        map={ports === 'map-allowed' ? { allowed: true, embedHref: 'about:blank' } : { allowed: false }}
      />
      <Footer footerGroups={normalizeFooterNavGroups(footerData)} />
    </div>
  )
}
const meta = {
  title: 'Domain/Clinic/Organisms/ClinicProfileComplete',
  component: StoryPage,
  args: { data: storyData, scenario: 'guest', ports: 'default' },
  argTypes: {
    scenario: { control: 'select', options: ['guest', 'signed-in', 'reauthentication', 'error', 'pending'] },
    ports: { control: 'select', options: ['default', 'copy-fails', 'save-fails', 'map-allowed'] },
  },
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs', 'domain:clinic', 'layer:organism', 'status:experimental', 'used-in:route:/clinics/[slug]'],
} satisfies Meta<typeof StoryPage>
export default meta
type Story = StoryObj<typeof meta>

async function choose(canvas: ReturnType<typeof within>, label: string, name: string) {
  const trigger = canvas.getByRole('combobox', { name: label })
  await userEvent.click(trigger)
  const popup = within(document.body)
  const search = popup.getByRole('combobox', { name: `Search ${label.toLowerCase()} options` })
  await expect(search).toHaveFocus()
  await userEvent.type(search, name)
  await userEvent.click(popup.getAllByRole('option', { name })[0]!)
  await expect(trigger).toHaveFocus()
}

export const Full: Story = {}

export const SelectionSync: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const treatment = args.data.treatments[0]!
    await choose(canvas, 'Treatment', treatment.name)
    await expect(canvas.getByRole('combobox', { name: 'Treatment' })).toHaveTextContent(treatment.name)
    await userEvent.click(canvas.getByRole('tab', { name: /treatments/i }))
    await expect(
      canvas.getByRole('button', { name: new RegExp(`${treatment.name}, selected for your inquiry`, 'i') }),
    ).toHaveAttribute('aria-pressed', 'true')
  },
}
export const Sparse: Story = {
  args: {
    data: {
      ...storyData,
      doctors: [],
      treatments: [],
      galleryImages: [],
      description: '',
      location: {},
      reviews: { totalCount: 0, items: [] },
      trust: { ...storyData.trust, reviewCount: 0, ratingValue: null },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('form', { name: 'Clinic appointment request' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Make an inquiry' })).not.toBeInTheDocument()
  },
}
export const MapAllowed: Story = { args: { ports: 'map-allowed' } }
export const MapKeyboard: Story = {
  args: { ports: 'map-allowed' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('button', { name: /^View location$/ })
    await userEvent.click(trigger)
    await expect(within(document.body).getByRole('heading', { name: /location of/i })).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveFocus()
  },
}
export const CopyFailure: Story = { args: { ports: 'copy-fails' } }
export const SaveFailure: Story = { args: { ports: 'save-fails' } }
export const SinglePhoto: Story = {
  args: { data: { ...storyData, galleryImages: storyData.galleryImages.slice(0, 1) } },
}
export const FailedPhoto: Story = {
  args: {
    data: {
      ...storyData,
      galleryImages: [{ id: 'unavailable', src: '/missing-storybook-photo.jpg', alt: 'Unavailable clinic photo' }],
    },
  },
}
export const SignedIn: Story = { args: { scenario: 'signed-in' } }
export const Reauthentication: Story = { args: { scenario: 'reauthentication' } }
export const Retry: Story = { args: { scenario: 'error' } }
export const Pending: Story = { args: { scenario: 'pending' } }

export const GuestInquiry: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.type(canvas.getByRole('textbox', { name: 'Message' }), 'Please contact me about the options.')
    await userEvent.type(canvas.getByRole('textbox', { name: 'First Name' }), 'Alex')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Last Name' }), 'Patient')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Phone Number' }), '+49 12345678')
    await userEvent.type(canvas.getByRole('textbox', { name: 'Email' }), 'alex@example.test')
    const checks = canvas.getAllByRole('checkbox')
    for (const check of checks) await userEvent.click(check)
    const submit = canvas.getByRole('button', { name: 'Save inquiry and create account' })
    await userEvent.click(submit)
    await expect(canvas.getByRole('combobox', { name: 'Treatment' })).toHaveAttribute('aria-invalid', 'true')
    await choose(canvas, 'Treatment', args.data.treatments[0]!.name)
    await userEvent.click(submit)
    await expect(await canvas.findByRole('button', { name: 'Inquiry saved, not sent' })).toBeDisabled()
  },
}
export const SignedInRetry: Story = {
  args: { scenario: 'error' },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await choose(canvas, 'Doctor', args.data.doctors[0]!.name)
    await userEvent.type(canvas.getByRole('textbox', { name: 'Message' }), 'Please contact me about the options.')
    await userEvent.click(canvas.getByRole('checkbox'))
    const submit = canvas.getByRole('button', { name: 'Submit Contact Request' })
    await userEvent.click(submit)
    await expect(await canvas.findByRole('alert')).toBeVisible()
    await userEvent.click(submit)
    await expect(await canvas.findByRole('button', { name: 'Request sent' })).toBeDisabled()
  },
}

export const PickerKeyboard: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const trigger = canvas.getByRole('combobox', { name: 'Treatment' })
    trigger.focus()
    await userEvent.keyboard('{Enter}')
    const search = within(document.body).getByRole('combobox', { name: 'Search treatment options' })
    await expect(search).toHaveFocus()
    await userEvent.type(search, 'nonexistent option')
    await userEvent.click(within(document.body).getByRole('button', { name: 'Clear search' }))
    await expect(search).toHaveValue('')
    await expect(search).toHaveFocus()
    await userEvent.keyboard('{Escape}')
    await expect(trigger).toHaveFocus()
  },
}

export const OverviewNavigation: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const review = args.data.reviews.items[0]!
    if (review.kind !== 'text') throw new Error('Expected a text review')
    await expect(within(canvas.getByRole('tabpanel', { name: 'Overview' })).getByText(review.comment)).toBeVisible()
    await userEvent.click(canvas.getByRole('button', { name: 'Read reviews' }))
    await expect(canvas.getByRole('tab', { name: /reviews/i })).toHaveAttribute('aria-selected', 'true')
    await userEvent.click(canvas.getByRole('tab', { name: 'Overview' }))
    const information = canvas.getByRole('button', { name: 'All clinic information' })
    await userEvent.click(information)
    await expect(within(document.body).getByRole('dialog')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    await expect(information).toHaveFocus()
  },
}
