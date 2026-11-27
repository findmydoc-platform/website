import * as React from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { ClinicContactRequestError, type ClinicDetailData } from '@/features/clinicDetail/contracts'
import type { PatientInquiryCreationContext } from '@/features/patientInquiries/creationContext'
import { clinicDetailFixture } from '@/stories/fixtures/clinicDetail'
import { ClinicProfileComplete } from './ClinicProfileComplete'

type Scenario = 'guest' | 'signed-in' | 'reauthentication' | 'error' | 'pending'
const guest: PatientInquiryCreationContext = { kind: 'guest' }
const signedIn: PatientInquiryCreationContext = {
  kind: 'authenticated',
  account: { firstName: 'Alex', lastName: 'Patient', email: 'alex@example.test', phoneNumber: '+49 12345678' },
  loginHref: '#',
}
const reauthentication: PatientInquiryCreationContext = { kind: 'reauthentication-required', loginHref: '#' }
function StoryPage({ data, scenario }: { data: ClinicDetailData; scenario: Scenario }) {
  const [saved, setSaved] = React.useState(false)
  const attempts = React.useRef(0)
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
      onClickCapture={(event) => {
        if ((event.target as HTMLElement).closest('a')) event.preventDefault()
      }}
    >
      <div className="bg-muted px-4 py-2 text-center text-sm" role="note">
        Storybook simulation. No inquiry is sent or saved.
      </div>
      <ClinicProfileComplete
        data={data}
        inquiryCreation={scenario === 'reauthentication' ? reauthentication : scenario === 'guest' ? guest : signedIn}
        onSubmitContactRequest={submit}
        favorite={{ isPatient: true, saved, onToggle: () => setSaved((value) => !value), onSignIn: () => {} }}
        share={{ url: 'https://example.test/clinic', onCopy: async () => {} }}
        inquiryNotice={
          <p role="note" className="mb-6 rounded-lg bg-muted p-3 text-sm">
            Storybook simulation. No inquiry is sent or saved.
          </p>
        }
        map={{ allowed: false }}
      />
    </div>
  )
}
const meta = {
  title: 'Domain/Clinic/Organisms/ClinicProfileComplete',
  component: StoryPage,
  args: { data: clinicDetailFixture, scenario: 'guest' },
  argTypes: {
    scenario: { control: 'select', options: ['guest', 'signed-in', 'reauthentication', 'error', 'pending'] },
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

export const Full: Story = {
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
      ...clinicDetailFixture,
      doctors: [],
      treatments: [],
      galleryImages: [],
      description: '',
      location: {},
      reviews: { totalCount: 0, items: [] },
      trust: { ...clinicDetailFixture.trust, reviewCount: 0, ratingValue: null },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.queryByRole('form', { name: 'Clinic appointment request' })).not.toBeInTheDocument()
    await expect(canvas.queryByRole('button', { name: 'Make an inquiry' })).not.toBeInTheDocument()
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
