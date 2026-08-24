import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'

import { Header } from '@/components/templates/Header/Component'
import {
  PatientInquiriesPage,
  type PatientInquiriesPageActions,
} from '@/components/templates/PatientInquiriesPage/Component'
import { PublicAccountMenu } from '@/components/templates/Header/PublicAccountMenu'
import { createInitialPatientInquiriesState } from '@/features/patientInquiries/model'
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

const actions: PatientInquiriesPageActions = {
  clearFailedMessage: fn(),
  goBack: fn(),
  retryDetail: fn(),
  retryQueue: fn(),
  retrySend: fn(),
  selectFile: fn(),
  selectFilter: fn(),
  selectInquiry: fn(),
  sendMessage: fn(),
  updateMessage: fn(),
}

const meta = {
  title: 'Domain/Patient/Pages/PatientInquiries',
  component: PatientInquiriesPage,
  args: {
    actions,
    detailView: activePatientInquiryDetail,
    loginHref: '/login/patient?next=%2Fpatient%2Finquiries',
    mode: 'detail',
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
    state: {
      ...activePatientInquiryState(),
      composer: { sendStatus: 'idle', text: 'My saved draft is still here.' },
      queue: { data: { ...patientInquiryQueue, changeCursor: 'queue-reopened' }, status: 'ready' },
    },
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

export const Active375: Story = withViewportStory(Active, 'public375', 'Active / 375')
export const Active768: Story = withViewportStory(Active, 'public768', 'Active / 768')
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
