import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { InquiryPreparationNotices } from './Component'

const meta = {
  title: 'Domain/Inquiry/Organisms/InquiryPreparationNotices',
  component: InquiryPreparationNotices,
  tags: ['autodocs', 'domain:inquiry', 'layer:organism', 'status:stable', 'used-in:route:patient-inquiries'],
  args: {
    items: [
      {
        reference: 'synthetic-preparation',
        authorizedAt: '2026-11-07T12:00:00.000Z',
        expiresAt: '2026-11-14T12:00:00.000Z',
        status: 'try-again',
        clinicName: 'Synthetic clinic with a long destination name for small screens',
      },
    ],
    loading: [],
    onRetry: fn(),
  },
} satisfies Meta<typeof InquiryPreparationNotices>
export default meta
type Story = StoryObj<typeof meta>

export const Retry: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('saved but not sent')
    await userEvent.click(canvas.getByRole('button', { name: 'Try again' }))
    await expect(args.onRetry).toHaveBeenCalledWith('synthetic-preparation')
  },
}
export const Sending: Story = { args: { loading: ['synthetic-preparation'] } }

export const PasswordSignInRequired: Story = {
  args: {
    items: [
      {
        reference: 'synthetic-password-proof',
        authorizedAt: '2026-11-07T12:00:00.000Z',
        expiresAt: '2026-11-14T12:00:00.000Z',
        status: 'sign-in-required',
        clinicName: 'Synthetic clinic',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: 'Sign in to send your inquiry' })).toHaveAttribute(
      'href',
      '/login/patient?next=/patient/inquiries',
    )
    await expect(canvas.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  },
}

export const IndependentFailures: Story = {
  args: {
    items: [
      {
        reference: 'clinic-b',
        authorizedAt: '2026-11-07T12:00:00.000Z',
        expiresAt: '2026-11-14T12:00:00.000Z',
        status: 'try-again',
        clinicName: 'Synthetic clinic B with a long destination name for narrow screens',
      },
      {
        reference: 'clinic-c',
        authorizedAt: '2026-11-08T12:00:00.000Z',
        expiresAt: '2026-11-15T12:00:00.000Z',
        status: 'try-again',
        clinicName: 'Synthetic clinic C',
      },
    ],
    errors: { 'clinic-b': 'This inquiry was not sent. Try again before it expires.' },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const notices = canvas.getAllByRole('status')
    await expect(within(notices[0]!).getByRole('alert')).toHaveTextContent('This inquiry was not sent.')
    await expect(within(notices[1]!).queryByRole('alert')).not.toBeInTheDocument()
    await userEvent.click(within(notices[1]!).getByRole('button', { name: 'Try again' }))
    await expect(args.onRetry).toHaveBeenCalledWith('clinic-c')
  },
}

export const UnknownOutcome: Story = {
  args: { unknown: ['synthetic-preparation'], onCheckStatus: fn() },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('submission result is not yet known')
    await expect(canvas.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Check status' }))
    await expect(args.onCheckStatus).toHaveBeenCalledWith('synthetic-preparation')
  },
}
export const Submitted: Story = {
  args: {
    items: [
      {
        reference: 'synthetic-completed',
        authorizedAt: '2026-11-07T12:00:00.000Z',
        expiresAt: '2026-11-14T12:00:00.000Z',
        status: 'submitted',
        clinicName: 'Synthetic clinic',
      },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('status')).toHaveTextContent('Your inquiry to Synthetic clinic has been sent.')
    await expect(canvas.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  },
}
