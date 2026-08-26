import type { Meta, StoryObj } from '@storybook/react-vite'
import * as React from 'react'
import { expect, fn, userEvent, within } from 'storybook/test'

import { Header } from '@/components/templates/Header/Component'
import {
  PatientInquiriesPage,
  type PatientInquiriesPageActions,
} from '@/components/templates/PatientInquiriesPage/Component'
import { PublicAccountMenu } from '@/components/templates/Header/PublicAccountMenu'
import { createInitialPatientInquiriesState } from '@/features/patientInquiries/model'
import { PatientInquiriesController } from '@/features/patientInquiries/PatientInquiriesController.client'
import type { PatientInquiriesApi } from '@/features/patientInquiries/browserGateway'
import {
  activePatientInquiryDetail,
  activePatientInquiryState,
  closedPatientInquiryDetail,
  patientInquiryQueue,
} from '@/stories/fixtures/patientInquiries'
import { normalizeHeaderNavItems } from '@/utilities/normalizeNavItems'
import { headerDataWithSubmenus } from '../templates/fixtures'
import { withViewportStory } from '../utils/viewportMatrix'

const navItems = normalizeHeaderNavItems(headerDataWithSubmenus)

const reopenedPatientInquiryDetail = {
  ...activePatientInquiryDetail,
  timeline: [
    ...activePatientInquiryDetail.timeline,
    {
      actor: { displayName: 'Izmir Coast Dental', isCurrentActor: false, kind: 'clinic' as const },
      createdAt: '2026-08-24T11:55:00.000Z',
      event: 'reopened' as const,
      id: 'event-reopened',
      kind: 'system-event' as const,
    },
  ],
}

const actions: PatientInquiriesPageActions = {
  clearFailedMessage: fn(),
  goBack: fn(),
  loadMore: fn(),
  retryDetail: fn(),
  retryQueue: fn(),
  retrySend: fn(),
  selectFile: fn(),
  selectFilter: fn(),
  selectInquiry: fn(),
  sendMessage: fn(),
  updateMessage: fn(),
}

function ControllerFlowHarness() {
  const api = React.useMemo<PatientInquiriesApi>(() => {
    let current = activePatientInquiryDetail
    return {
      attachmentDownloadHref: (attachmentId) =>
        `/api/patient/inquiries/attachments/download?attachmentId=${attachmentId}`,
      createDraft: async () => {
        throw new Error('Attachment upload is not used in this story.')
      },
      discardDraft: async () => ({ discarded: true }),
      finalizeDraft: async () => ({ finalized: true }),
      readDetail: async () => ({ changeCursor: `detail-${current.revision}`, inquiry: current, unchanged: false }),
      readQueue: async () => patientInquiryQueue,
      sendMessage: async (input) => {
        current = {
          ...current,
          lastActivityAt: '2026-08-24T12:05:00.000Z',
          revision: current.revision + 1,
          timeline: [
            ...current.timeline,
            {
              actor: { displayName: 'Aylin Synthetic', isCurrentActor: true, kind: 'patient' },
              createdAt: '2026-08-24T12:05:00.000Z',
              id: 'message-story-confirmed',
              kind: 'external-message',
              text: input.text,
            },
          ],
        }
        return { inquiry: current }
      },
      updateReadPosition: async () => ({ unread: { count: 0, isUnread: false } }),
      uploadDraft: async () => undefined,
    }
  }, [])
  return (
    <PatientInquiriesController
      api={api}
      initialInquiryId="inquiry-izmir"
      loginHref="/login/patient?next=%2Fpatient%2Finquiries%2Finquiry-izmir"
      mode="detail"
      pollIntervalMs={60_000}
    />
  )
}

const meta = {
  title: 'Domain/Patient/Pages/PatientInquiries',
  component: PatientInquiriesPage,
  args: {
    actions,
    detailView: activePatientInquiryDetail,
    loginHref: '/login/patient?next=%2Fpatient%2Finquiries',
    mode: 'detail',
    now: new Date('2026-08-24T12:00:00.000Z'),
    state: activePatientInquiryState(),
  },
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Private patient workspace for reviewing and replying to clinic inquiries.',
      },
    },
  },
  tags: ['autodocs', 'domain:patient', 'layer:page', 'status:stable', 'used-in:route:/patient/inquiries'],
  render: (args) => (
    <>
      <Header
        navItems={navItems}
        rightActions={
          <PublicAccountMenu
            links={{ dashboard: '/patient/inquiries', favorites: '/patient/favorites', signOut: '/logout' }}
            state={{ displayName: 'Aylin Synthetic', email: 'patient@example.test', kind: 'patient' }}
          />
        }
        showPreviewBadge={false}
      />
      <PatientInquiriesPage {...args} />
    </>
  ),
} satisfies Meta<typeof PatientInquiriesPage>

export default meta
type Story = StoryObj<typeof meta>

export const Active: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('region', { name: 'Conversation with Izmir Coast Dental' })).toBeInTheDocument()
    await expect(canvas.getAllByText('Clinic')).toHaveLength(2)
    await expect(canvas.getByText('You')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Send' })).toBeDisabled()
    await expect(canvas.getByRole('link', { name: 'Download treatment-plan.pdf' })).toHaveAttribute(
      'href',
      '/api/patient/inquiries/attachments/download?attachmentId=attachment-plan',
    )
  },
}

export const Closed: Story = {
  args: {
    detailView: closedPatientInquiryDetail,
    state: {
      ...activePatientInquiryState(),
      detail: { changeCursor: 'detail-closed', data: closedPatientInquiryDetail, status: 'ready' },
      selectedInquiryId: 'inquiry-ankara',
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('heading', { name: 'This inquiry is closed' })).toBeInTheDocument()
    await expect(canvas.queryByRole('textbox', { name: 'Message' })).not.toBeInTheDocument()
  },
}

export const Empty: Story = {
  args: {
    detailView: undefined,
    mode: 'index',
    state: {
      ...createInitialPatientInquiriesState(),
      queue: {
        data: {
          changeCursor: 'queue-empty',
          counts: { all: 0, closed: 0, open: 0 },
          items: [],
          unchanged: false,
          unreadCount: 0,
        },
        status: 'ready',
      },
    },
  },
}

export const Loading: Story = {
  args: {
    detailView: undefined,
    mode: 'index',
    state: { ...createInitialPatientInquiriesState(), queue: { status: 'loading' } },
  },
}

export const LoadError: Story = {
  args: {
    detailView: undefined,
    mode: 'index',
    state: {
      ...createInitialPatientInquiriesState(),
      queue: { error: 'Check your connection and try again.', status: 'error' },
    },
  },
}

export const SendError: Story = {
  args: {
    state: {
      ...activePatientInquiryState(),
      composer: {
        error: 'Your message was not sent. Try again.',
        idempotencyKey: 'story-message-key',
        retryReady: true,
        sendStatus: 'error',
        text: 'Tuesday at 15:00 CET works for me.',
      },
    },
  },
}

export const Uploading: Story = {
  args: {
    state: {
      ...activePatientInquiryState(),
      composer: {
        file: new File(['synthetic xray'], 'dental-xray.jpg', { type: 'image/jpeg' }),
        sendStatus: 'uploading',
        text: 'Tuesday at 15:00 CET works for me.',
        uploadProgress: 50,
      },
    },
  },
}

export const InvalidAttachment: Story = {
  args: {
    state: {
      ...activePatientInquiryState(),
      composer: {
        file: new File(['synthetic archive'], 'full-scan.zip', { type: 'application/zip' }),
        fileError: 'Choose a PNG, JPEG, WebP or PDF file up to 5 MB.',
        sendStatus: 'idle',
        text: 'Tuesday at 15:00 CET works for me.',
      },
    },
  },
}

export const SessionLost: Story = {
  args: {
    detailView: undefined,
    mode: 'index',
    state: { ...createInitialPatientInquiriesState(), sessionEnded: true },
  },
}

export const Reopened: Story = {
  args: {
    detailView: reopenedPatientInquiryDetail,
    state: {
      ...activePatientInquiryState(),
      composer: { sendStatus: 'idle', text: 'My saved draft is still here.' },
      detail: { changeCursor: 'detail-reopened', data: reopenedPatientInquiryDetail, status: 'ready' },
      queue: { data: { ...patientInquiryQueue, changeCursor: 'queue-reopened' }, status: 'ready' },
    },
  },
  play: async ({ canvasElement }) => {
    await expect(within(canvasElement).getByText('The clinic reopened this inquiry.')).toBeInTheDocument()
  },
}

export const Conflict: Story = {
  args: {
    state: {
      ...activePatientInquiryState(),
      composer: {
        error: 'The inquiry changed while you were replying.',
        idempotencyKey: 'story-conflict-key',
        retryReady: true,
        sendStatus: 'error',
        text: 'Please keep this draft.',
      },
    },
  },
}

export const DetailError: Story = {
  args: {
    detailView: undefined,
    state: {
      ...activePatientInquiryState(),
      detail: { error: 'Check your connection and try again.', status: 'error' },
    },
  },
}

export const ControllerFlow: Story = {
  render: () => <ControllerFlowHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const message = await canvas.findByRole('textbox', { name: 'Message' })
    await userEvent.type(message, 'Tuesday at 15:00 works.')
    await userEvent.click(canvas.getByRole('button', { name: 'Send' }))
    await expect(canvas.findByText('Tuesday at 15:00 works.')).resolves.toBeInTheDocument()
  },
}

export const Active375: Story = withViewportStory(Active, 'public375', 'Active / 375')
export const Active320: Story = withViewportStory(Active, 'public320', 'Active / 320')
export const Active320Short: Story = withViewportStory(Active, 'public320Short', 'Active / 320 short')
export const Active375Short: Story = withViewportStory(Active, 'public375Short', 'Active / 375 short')
export const Active640: Story = withViewportStory(Active, 'public640', 'Active / 640')
export const Active768: Story = withViewportStory(Active, 'public768', 'Active / 768')
export const Active1024: Story = withViewportStory(Active, 'public1024', 'Active / 1024')
export const Active1280: Story = withViewportStory(Active, 'public1280', 'Active / 1280')
export const Closed375: Story = withViewportStory(Closed, 'public375', 'Closed / 375')
export const Closed1280: Story = withViewportStory(Closed, 'public1280', 'Closed / 1280')
export const LoadError375: Story = withViewportStory(LoadError, 'public375', 'Load error / 375')
export const SendError1280: Story = withViewportStory(SendError, 'public1280', 'Send error / 1280')
export const Uploading375: Story = withViewportStory(Uploading, 'public375', 'Uploading / 375')
export const InvalidAttachment1280: Story = withViewportStory(
  InvalidAttachment,
  'public1280',
  'Invalid attachment / 1280',
)
