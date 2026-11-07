import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PatientInquiryQueue } from './Component'
import { patientInquiryQueue } from '@/stories/fixtures/patientInquiries'

const meta = {
  title: 'Domain/Inquiry/Organisms/PatientInquiryQueue',
  component: PatientInquiryQueue,
  tags: ['autodocs', 'domain:inquiry', 'layer:organism', 'status:stable', 'used-in:route:patient-inquiries'],
  args: {
    data: { ...patientInquiryQueue, items: [], counts: { all: 0, open: 0, closed: 0 }, nextCursor: undefined },
    filter: 'all',
    status: 'ready',
    loadingMore: false,
    onFilterChange: fn(),
    onLoadMore: fn(),
    onRetry: fn(),
    onSelect: fn(),
    now: new Date('2026-11-07T12:00:00Z'),
  },
} satisfies Meta<typeof PatientInquiryQueue>
export default meta
type Story = StoryObj<typeof meta>

export const UnconfirmedDelivery: Story = {
  args: {
    preparations: {
      items: [
        {
          reference: 'prepared',
          authorizedAt: '2026-11-07T12:00:00Z',
          expiresAt: '2026-11-14T12:00:00Z',
          status: 'outcome-unknown',
          clinicName: 'Synthetic clinic with a long destination name',
        },
      ],
      loading: [],
      onRetry: fn(),
      onCheckStatus: fn(),
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const list = canvas.getByRole('region', { name: 'Patient inquiry list' })
    await expect(within(list).getByRole('listitem')).toHaveTextContent('Delivery not confirmed')
    await expect(canvas.queryByText('No inquiries here')).not.toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Check status' }))
    await expect(args.preparations!.onCheckStatus).toHaveBeenCalledWith('prepared')
  },
}

export const ConfirmedDelivery: Story = {
  args: {
    data: { ...patientInquiryQueue, items: [patientInquiryQueue.items[0]!], counts: { all: 1, open: 1, closed: 0 } },
    preparations: {
      items: [
        {
          reference: 'prepared',
          authorizedAt: '2026-11-07T12:00:00Z',
          expiresAt: '2026-11-14T12:00:00Z',
          status: 'submitted',
          inquiryId: patientInquiryQueue.items[0]!.id,
          clinicName: patientInquiryQueue.items[0]!.clinic.displayName,
        },
      ],
      loading: [],
      onRetry: fn(),
      announcement: 'Your inquiry has been sent.',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('listitem')).toHaveLength(1)
    await expect(canvas.getByRole('link')).toHaveAttribute(
      'href',
      `/patient/inquiries/${patientInquiryQueue.items[0]!.id}`,
    )
    await expect(canvas.getByRole('status')).toHaveTextContent('Your inquiry has been sent.')
  },
}

export const CompletedFirstPageWithOlderInquiries: Story = {
  args: {
    data: {
      ...patientInquiryQueue,
      items: Array.from({ length: 25 }, (_, index) => ({ ...patientInquiryQueue.items[0]!, id: `recent-${index}` })),
      counts: { all: 26, open: 26, closed: 0 },
      nextCursor: 'older',
    },
    preparations: {
      items: Array.from({ length: 25 }, (_, index) => ({
        reference: `prepared-${index}`,
        authorizedAt: '2026-11-07T12:00:00Z',
        expiresAt: '2026-11-14T12:00:00Z',
        status: 'submitted' as const,
        inquiryId: `recent-${index}`,
        clinicName: patientInquiryQueue.items[0]!.clinic.displayName,
      })),
      loading: [],
      onRetry: fn(),
    },
  },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getAllByRole('listitem')).toHaveLength(25)
    await userEvent.click(canvas.getByRole('button', { name: 'Load more inquiries' }))
    await expect(args.onLoadMore).toHaveBeenCalledOnce()
  },
}
