import germanMessages from '@findmydoc-platform/ui-copy/de.json'
import type { Meta, StoryObj } from '@storybook/react-vite'
import Link from 'next/link'
import { useReducer } from 'react'
import { expect, userEvent, within } from 'storybook/test'

import { Container } from '@/components/molecules/Container'
import { FavoriteClinicsList } from '@/features/favorites/FavoriteClinicsList.client'
import * as LoginForm from '@/components/organisms/Auth/LoginForm'
import { PublicLanguageSwitcher } from '@/components/molecules/PublicLanguageSwitcher'
import { Footer } from '@/components/templates/Footer/Component'
import { Header } from '@/components/templates/Header/Component'
import { PreviewDataNotice } from '@/components/templates/PreviewDataNotice/Component'
import {
  createInitialPatientInquiriesState,
  patientInquiriesReducer,
  type PatientInquiryFilter,
  type PatientInquiriesState,
  validatePatientInquiryFile,
} from '@/features/patientInquiries/model'
import {
  activePatientInquiryDetail,
  closedPatientInquiryDetail,
  patientInquiryQueue,
} from '@/stories/fixtures/patientInquiries'
import { withMockRouter } from '@/stories/utils/routerDecorator'
import type { FooterNavGroup } from '@/utilities/normalizeNavItems'
import {
  PublicAuthRouteShell,
  PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME,
} from '@/app/(frontend)/_components/PublicAuthRouteShell'
import { PreparedInquiryConfirmation } from '@/app/(frontend)/_components/PreparedInquiryConfirmation'
import { PublicAccountMenu } from '@/components/templates/Header/PublicAccountMenu'
import {
  PatientInquiriesPage,
  type PatientInquiriesPageActions,
} from '@/components/templates/PatientInquiriesPage/Component'

const clinicName = 'International Center for Restorative Dentistry and Oral Rehabilitation'
const filename = 'Preliminary-treatment-plan-and-estimate-International-Dentistry-November-2026.pdf'
const draftText = 'Can we schedule a video call next week?'
const clinic = { ...activePatientInquiryDetail.clinic, displayName: clinicName }
const interest = { label: 'Full mouth reconstruction and implant-supported dental rehabilitation' }
const longDetail = {
  ...activePatientInquiryDetail,
  clinic,
  interest,
  originalRequest: {
    ...activePatientInquiryDetail.originalRequest,
    message:
      'I would like to discuss full mouth rehabilitation and the likely sequence of visits. ' +
      'Please let me know if an initial video consultation is possible and what information you need beforehand. ' +
      'I will be travelling internationally and need to plan around work. '.repeat(8),
  },
  unread: { count: 0, isUnread: false },
  timeline: activePatientInquiryDetail.timeline.map((item, index) =>
    index === 0 && item.kind === 'external-message' && item.attachment
      ? { ...item, attachment: { ...item.attachment, fileName: filename } }
      : item,
  ),
}
const queue = {
  ...patientInquiryQueue,
  items: patientInquiryQueue.items.map((item, index) => (index === 0 ? { ...item, clinic, interest } : item)),
}
const emptyQueue = { ...queue, counts: { all: 0, open: 0, closed: 0 }, items: [], unreadCount: 0 }
const footerGroups: FooterNavGroup[] = [
  { title: 'About', items: [] },
  { title: 'Services', items: [] },
  {
    title: 'Information',
    items: [
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Imprint', href: '/imprint' },
    ],
  },
]

function PreviewChrome({ children, guest = false }: { children: React.ReactNode; guest?: boolean }) {
  const locale = guest ? 'de' : 'en'
  const loginPath = '/login/patient?message=patient-check-email'
  return (
    <div className="flex min-h-svh flex-col bg-site-canvas" lang={locale}>
      <Header
        navItems={[]}
        showPreviewBadge
        languageSwitcher={
          <PublicLanguageSwitcher
            locale={locale}
            label={guest ? 'Sprache' : 'Language'}
            options={[
              { locale: 'en', name: 'English', href: '/en' + loginPath, unavailable: '' },
              { locale: 'de', name: 'Deutsch', href: loginPath, unavailable: '' },
            ]}
            confirmation={{
              title: 'Change language?',
              description: 'Switch the language of this page.',
              stay: 'Stay here',
              confirm: 'Switch language',
              close: 'Close',
            }}
            onConfirm={() => undefined}
            renderLink={(option, shouldNavigate) => (
              <Link
                href={option.href}
                onClick={(event) => {
                  event.preventDefault()
                  shouldNavigate()
                }}
              >
                {option.name}
              </Link>
            )}
          />
        }
        rightActions={
          <PublicAccountMenu
            links={{ profile: null }}
            state={
              guest
                ? { kind: 'guest' }
                : { displayName: 'Current Patient', email: 'audit-patient@example.test', kind: 'patient' }
            }
          />
        }
      />
      <PreviewDataNotice />
      <main>{children}</main>
      <Footer footerGroups={footerGroups} showPreviewBadge />
    </div>
  )
}

type InquiryPreviewState = 'conversation' | 'send-error' | 'list' | 'loading' | 'empty' | 'load-error'

function InquiryPreview({ example = 'list' }: { example?: InquiryPreviewState }) {
  const startsWithDetail = example === 'conversation' || example === 'send-error'
  const [state, dispatch] = useReducer(patientInquiriesReducer, example, (caseName): PatientInquiriesState => {
    const initial = createInitialPatientInquiriesState(startsWithDetail ? longDetail.id : undefined)
    return {
      ...initial,
      queue:
        caseName === 'loading'
          ? { status: 'loading' }
          : caseName === 'load-error'
            ? { status: 'error', error: 'Check your connection and try again.' }
            : { data: caseName === 'empty' ? emptyQueue : queue, status: 'ready' },
      detail: startsWithDetail ? { data: longDetail, status: 'ready' } : initial.detail,
      composer:
        caseName === 'send-error'
          ? {
              text: draftText,
              sendStatus: 'error',
              retryReady: true,
              idempotencyKey: 'story-draft',
              error: 'Not sent',
            }
          : initial.composer,
    }
  })
  const detailView = state.detail.data
  const queueForFilter = (filter: PatientInquiryFilter) => ({
    ...queue,
    items: filter === 'all' ? queue.items : queue.items.filter((item) => item.lifecycle === filter),
  })
  const loadQueue = (filter: PatientInquiryFilter) => {
    dispatch({ queue: queueForFilter(filter), scope: { filter, limit: 25 }, type: 'queue-loaded' })
  }
  const sendDraft = (retry: boolean) => {
    if (!detailView || (!state.composer.text.trim() && !state.composer.file)) return
    if (retry && (!state.composer.idempotencyKey || !state.composer.retryReady)) return
    dispatch(retry ? { type: 'send-retry-started' } : { type: 'send-started', idempotencyKey: 'story-draft' })
    dispatch({
      type: 'send-succeeded',
      inquiry: {
        ...detailView,
        revision: detailView.revision + 1,
        timeline: [
          ...detailView.timeline,
          {
            actor: { displayName: 'Current Patient', isCurrentActor: true, kind: 'patient' },
            createdAt: '2026-08-24T08:07:00.000Z',
            id: 'story-message-' + detailView.revision,
            kind: 'external-message',
            text: state.composer.text,
          },
        ],
      },
    })
  }
  const actions: PatientInquiriesPageActions = {
    goBack: () => dispatch({ type: 'inquiry-cleared' }),
    selectInquiry: (inquiryId) => {
      const inquiry = inquiryId === closedPatientInquiryDetail.id ? closedPatientInquiryDetail : longDetail
      dispatch({ type: 'inquiry-selected', inquiryId })
      dispatch({ type: 'detail-loaded', inquiry, changeCursor: 'story-detail-' + inquiryId })
    },
    selectFilter: (filter) => {
      dispatch({ type: 'filter-changed', filter })
      loadQueue(filter)
    },
    retryQueue: () => loadQueue(state.filter),
    loadMore: () => undefined,
    retryDetail: () => undefined,
    selectFile: (file) =>
      dispatch({
        type: 'composer-file-changed',
        file,
        fileError: file ? (validatePatientInquiryFile(file) ?? undefined) : undefined,
      }),
    retrySend: () => sendDraft(true),
    sendMessage: () => sendDraft(false),
    clearFailedMessage: () => dispatch({ type: 'composer-cleared' }),
    submitAppeal: async () => ({ ok: true }),
    submitReport: async () => ({ ok: true }),
    updateMessage: (text) => dispatch({ type: 'composer-text-changed', text }),
  }
  return (
    <PreviewChrome>
      <PatientInquiriesPage
        actions={actions}
        detailView={detailView}
        mode={state.selectedInquiryId ? 'detail' : 'index'}
        loginHref="/login/patient?next=%2Fpatient%2Finquiries"
        state={state}
        now={new Date('2026-11-27T10:00:00.000Z')}
      />
    </PreviewChrome>
  )
}

function RegistrationPreview() {
  const loginCopy = germanMessages.auth.patientLogin

  return (
    <PreviewChrome guest>
      <PublicAuthRouteShell>
        <LoginForm.Root
          userTypes="patient"
          loginHandler={async () => ({ error: 'Testkonto. Anmeldung ist in dieser Vorschau deaktiviert.' })}
          className={`w-full max-w-md ${PUBLIC_AUTH_FORM_CONTAINER_CLASSNAME}`}
        >
          <PreparedInquiryConfirmation
            title="Prüfen Sie Ihren Posteingang."
            guidance="Bestätigen Sie Ihre E-Mail-Adresse, um Ihr Patientenkonto zu öffnen."
            savedStatus="Ihre Anfrage ist gespeichert und wurde noch nicht gesendet."
            deadline="Die Anfrage läuft am 04.12.26, 10:23:00 UTC ab."
            expiresAt="2026-12-04T10:23:00Z"
            resendHref="/register/patient#patient-verification-resend"
            resendLabel="Bestätigungs-E-Mail erneut anfordern"
          />
          <LoginForm.Status />
          <LoginForm.Form className="mt-4 border-t border-site-divider pt-4">
            <LoginForm.EmailField label={loginCopy.email.label} defaultValue="preparation-browser@example.test" />
            <LoginForm.PasswordField
              label={loginCopy.password.label}
              forgotPasswordLabel={loginCopy.password.forgot}
              forgotPasswordHref="/auth/password/reset"
              className="[&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:underline [&_a]:underline-offset-4"
            />
            <LoginForm.SubmitButton loadingText={loginCopy.submitting} variant="outline">
              {loginCopy.submit}
            </LoginForm.SubmitButton>
          </LoginForm.Form>
          <LoginForm.Footer>
            <p className="text-sm">
              Sie haben noch kein Konto?{' '}
              <Link href="/register/patient" className="inline-flex min-h-11 items-center text-primary underline">
                Hier registrieren
              </Link>
            </p>
            <Link href="/" className="inline-flex min-h-11 items-center text-sm text-primary underline">
              ← Zur Startseite
            </Link>
          </LoginForm.Footer>
        </LoginForm.Root>
      </PublicAuthRouteShell>
    </PreviewChrome>
  )
}

const meta = {
  title: 'Internal/Patient/Pages/Inquiry Fixes',
  component: InquiryPreview,
  parameters: { layout: 'fullscreen' },
  decorators: [withMockRouter],
  tags: ['autodocs', 'domain:patient', 'layer:page', 'status:experimental', 'used-in:route:/patient/inquiries'],
} satisfies Meta<typeof InquiryPreview>

export default meta

type Story = StoryObj<typeof meta>

export const Conversation: Story = { args: { example: 'conversation' } }

export const ConversationInteractions: Story = {
  ...Conversation,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const summary = canvas.getByText('Original request', { exact: true })
    await userEvent.click(summary)
    await expect(summary.closest('details')).toHaveAttribute('open')
    await expect(canvas.getByRole('link', { name: 'Download ' + filename })).toBeVisible()
    await userEvent.click(summary)
    await expect(summary.closest('details')).not.toHaveAttribute('open')
  },
}

export const SendError: Story = { args: { example: 'send-error' } }
export const InquiryList: Story = { args: { example: 'list' } }
export const ListLoading: Story = { args: { example: 'loading' } }
export const ListEmpty: Story = { args: { example: 'empty' } }
export const ListLoadError: Story = { args: { example: 'load-error' } }
export const AfterRegistration: Story = { render: () => <RegistrationPreview /> }
export const AccountMenu: Story = {
  render: () => (
    <PreviewChrome>
      <div className="bg-site-section py-8 sm:py-12 lg:py-14">
        <Container>
          <FavoriteClinicsList initialItems={[]} />
        </Container>
      </div>
    </PreviewChrome>
  ),
}
