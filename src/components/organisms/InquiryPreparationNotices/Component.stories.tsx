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
