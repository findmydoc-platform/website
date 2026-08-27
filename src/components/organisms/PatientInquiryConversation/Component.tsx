'use client'

import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Download,
  Ellipsis,
  Flag,
  File,
  FileImage,
  LoaderCircle,
  LockKeyhole,
  Paperclip,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/atoms/dropdown-menu'
import { Textarea } from '@/components/atoms/textarea'
import {
  InquiryAppealDialog,
  InquiryReportDialog,
  type InquiryAppealFormValues,
  type InquiryReportFormValues,
  type InquiryReportTarget,
} from '@/components/molecules/InquiryModerationDialog/Component'
import { formatInquiryRequestOption } from '@/features/inquiryRequest/options'
import type { PatientInquiryComposerState } from '@/features/patientInquiries/model'
import type { PatientInquiryDetailView, PatientInquiryTimelineItemView } from '@/features/patientInquiries/viewModel'
import { cn } from '@/utilities/ui'

type PatientInquiryConversationProps = {
  composer: PatientInquiryComposerState
  detail?: PatientInquiryDetailView
  error?: string
  now?: Date
  onBack: () => void
  onClearFailed: () => void
  onFileChange: (file?: File) => void
  onRetry: () => void
  onRetrySend: () => void
  onSend: () => void
  onSubmitAppeal: (caseId: string, values: InquiryAppealFormValues) => Promise<{ error?: string; ok: boolean }>
  onSubmitReport: (
    target: InquiryReportTarget,
    values: InquiryReportFormValues,
  ) => Promise<{ error?: string; ok: boolean }>
  onTextChange: (text: string) => void
  status: 'error' | 'idle' | 'loading' | 'ready'
}

const getInitials = (name: string): string =>
  name
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CL'

const formatTime = (value: string): string =>
  new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))

const formatDay = (value: string, now: Date): string => {
  const date = new Date(value)
  if (date.toDateString() === now.toDateString()) return 'Today'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(date)
}

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const categoryLabel = (category?: string): string =>
  ({
    'harassment-threats': 'Harassment or threats',
    other: 'Other',
    'privacy-concern': 'Privacy concern or wrong recipient',
    'spam-fraud-impersonation': 'Spam, fraud or impersonation',
    'suspected-illegal-content': 'Suspected illegal content',
  })[category ?? ''] ?? 'Policy concern'

const plainTextWithLinks = (text: string): React.ReactNode[] =>
  text.split(/(https?:\/\/[^\s]+)/gu).map((part, index) => {
    if (!part.startsWith('http://') && !part.startsWith('https://')) return part
    try {
      const url = new URL(part)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return part
      return (
        <a
          key={`${part}-${index}`}
          className="font-medium text-primary underline decoration-primary/40 underline-offset-2 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          href={url.href}
          rel="noreferrer noopener"
          target="_blank"
        >
          {part}
        </a>
      )
    } catch {
      return part
    }
  })

const Attachment = ({
  item,
  onAppeal,
  onReport,
  reportTarget,
}: {
  item: PatientInquiryTimelineItemView
  onAppeal: (caseId: string) => void
  onReport: (target: InquiryReportTarget, returnFocusElement?: HTMLElement | null) => void
  reportTarget?: InquiryReportTarget
}) => {
  const reportTriggerRef = React.useRef<HTMLButtonElement>(null)
  if (item.kind !== 'external-message') return null
  if (item.attachmentState === 'hard-deleted') {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm text-muted-foreground">
        <p className="inline-flex items-center gap-2 font-medium">
          <Trash2 className="size-4" aria-hidden="true" /> Attachment deleted
        </p>
      </div>
    )
  }
  if (item.attachmentState === 'restricted') {
    return (
      <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3 py-3 text-sm">
        <p className="inline-flex items-center gap-2 font-medium text-muted-foreground">
          <LockKeyhole className="size-4" aria-hidden="true" /> Attachment unavailable
        </p>
        {item.attachmentModeration?.isCurrentActorAffected ? (
          <div className="mt-2 text-xs leading-5 text-muted-foreground">
            <p>findmydoc restricted this attachment · {categoryLabel(item.attachmentModeration.category)}</p>
            {item.attachmentModeration.appeal?.state === 'available' ? (
              <Button
                type="button"
                size="sm"
                variant="link"
                className="min-h-11 px-0"
                onClick={() => onAppeal(item.attachmentModeration?.appeal?.caseId ?? '')}
              >
                Appeal decision
              </Button>
            ) : item.attachmentModeration.appeal?.state === 'submitted' ? (
              <p>Appeal submitted</p>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }
  if (item.kind !== 'external-message' || !item.attachment) return null
  const Icon = item.attachment.mimeType === 'application/pdf' ? File : FileImage
  return (
    <div className="mt-3 flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-3">
      <Icon className="size-7 shrink-0 text-primary" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">{item.attachment.fileName}</span>
        <span className="block text-xs text-muted-foreground">{formatBytes(item.attachment.sizeBytes)}</span>
      </span>
      {item.attachmentDownloadHref ? (
        <a
          className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          href={item.attachmentDownloadHref}
          aria-label={`Download ${item.attachment.fileName}`}
        >
          <Download className="size-5" aria-hidden="true" />
        </a>
      ) : null}
      {reportTarget ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              ref={reportTriggerRef}
              type="button"
              size="icon"
              variant="ghost"
              className="size-11"
              aria-label={`Attachment actions for ${item.attachment.fileName}`}
            >
              <Ellipsis className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onReport(reportTarget, reportTriggerRef.current)}>
              <Flag aria-hidden="true" /> Report attachment
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  )
}

const MessageActions = ({
  item,
  onReport,
  target,
}: {
  item: PatientInquiryTimelineItemView
  onReport: (target: InquiryReportTarget, returnFocusElement?: HTMLElement | null) => void
  target: InquiryReportTarget
}) => {
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          ref={triggerRef}
          type="button"
          size="icon"
          variant="ghost"
          className="size-11"
          aria-label={`Message actions for Clinic message at ${formatTime(item.createdAt)}`}
        >
          <Ellipsis className="size-4" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => onReport(target, triggerRef.current)}>
          <Flag aria-hidden="true" /> Report message
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const Timeline = ({
  detail,
  firstUnreadId,
  now,
  onAppeal,
  onReport,
}: {
  detail: PatientInquiryDetailView
  firstUnreadId?: string
  now: Date
  onAppeal: (caseId: string) => void
  onReport: (target: InquiryReportTarget, returnFocusElement?: HTMLElement | null) => void
}) => {
  const visibleTimeline = detail.timeline.filter((item) => item.kind !== 'internal-note')
  let lastDay = ''
  return (
    <ol aria-label="Inquiry messages" className="space-y-5 px-4 py-6 sm:px-6 lg:px-7">
      {visibleTimeline.map((item) => {
        const day = new Date(item.createdAt).toDateString()
        const showDay = day !== lastDay
        lastDay = day
        if (item.kind === 'system-event') {
          return (
            <li key={item.id}>
              {showDay ? (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  {formatDay(item.createdAt, now)}
                  <span className="h-px flex-1 bg-border" />
                </div>
              ) : null}
              <p className="text-center text-sm text-muted-foreground" role="status">
                {item.event === 'reopened'
                  ? 'The clinic reopened this inquiry.'
                  : item.event === 'moderation-restricted'
                    ? 'findmydoc restricted communication in this inquiry.'
                    : item.event === 'moderation-restored'
                      ? 'findmydoc restored communication in this inquiry.'
                      : 'The inquiry status changed.'}
              </p>
            </li>
          )
        }
        if (item.kind !== 'external-message') return null
        const hardDeleted = item.contentState === 'hard-deleted'
        const current = !hardDeleted && item.actor.isCurrentActor
        return (
          <li key={item.id} data-first-unread={item.id === firstUnreadId ? 'true' : undefined}>
            {showDay ? (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {formatDay(item.createdAt, now)}
                <span className="h-px flex-1 bg-border" />
              </div>
            ) : null}
            <article
              aria-label={`${hardDeleted ? 'Deleted' : current ? 'You' : 'Clinic'} message at ${formatTime(item.createdAt)}`}
              className={cn('flex gap-3', (current || hardDeleted) && 'justify-end')}
            >
              {!current && !hardDeleted ? (
                <span
                  aria-hidden="true"
                  className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-bold"
                >
                  {getInitials(detail.clinic.displayName)}
                </span>
              ) : null}
              <div
                className={cn(
                  'min-w-0',
                  current || hardDeleted
                    ? 'ml-auto max-w-[88%] sm:max-w-[75%]'
                    : 'max-w-[calc(100%-3.25rem)] flex-1 sm:max-w-[75%]',
                )}
              >
                <div
                  className={cn(
                    'mb-2 flex items-center gap-6 text-sm',
                    hardDeleted ? 'justify-end' : 'justify-between',
                  )}
                >
                  {!hardDeleted ? <strong>{current ? 'You' : 'Clinic'}</strong> : null}
                  <span className="inline-flex items-center gap-2">
                    <time className="text-muted-foreground" dateTime={item.createdAt}>
                      {formatTime(item.createdAt)}
                    </time>
                    {!current && item.contentState !== 'restricted' && item.contentState !== 'hard-deleted' ? (
                      <MessageActions
                        item={item}
                        onReport={onReport}
                        target={{
                          inquiryId: detail.id,
                          label: 'message',
                          preview: item.text ?? 'Message',
                          targetId: item.id,
                          targetType: 'message',
                        }}
                      />
                    ) : null}
                  </span>
                </div>
                <div
                  className={cn(
                    'rounded-xl border px-4 py-3 text-[0.95rem] leading-7 [overflow-wrap:anywhere]',
                    current ? 'border-primary/25 bg-primary/5' : 'border-border bg-muted/35',
                  )}
                >
                  {item.contentState === 'hard-deleted' ? (
                    <p className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground">
                      <Trash2 className="size-4" aria-hidden="true" /> Message deleted
                    </p>
                  ) : item.contentState === 'restricted' ? (
                    <div className="text-sm text-muted-foreground">
                      <p className="inline-flex items-center gap-2 font-medium">
                        <LockKeyhole className="size-4" aria-hidden="true" /> Message unavailable
                      </p>
                      {item.moderation?.isCurrentActorAffected ? (
                        <div className="mt-2 text-xs leading-5">
                          <p>findmydoc restricted this message · {categoryLabel(item.moderation.category)}</p>
                          {item.moderation.appeal?.state === 'available' ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="link"
                              className="min-h-11 px-0"
                              onClick={() => onAppeal(item.moderation?.appeal?.caseId ?? '')}
                            >
                              Appeal decision
                            </Button>
                          ) : item.moderation.appeal?.state === 'submitted' ? (
                            <p>Appeal submitted</p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : item.text ? (
                    <p className="whitespace-pre-wrap">{plainTextWithLinks(item.text)}</p>
                  ) : null}
                  <Attachment
                    item={item}
                    onAppeal={onAppeal}
                    onReport={onReport}
                    reportTarget={
                      !current && item.attachment
                        ? {
                            inquiryId: detail.id,
                            label: 'attachment',
                            preview: item.attachment.fileName,
                            targetId: item.attachment.id,
                            targetType: 'attachment',
                          }
                        : undefined
                    }
                  />
                </div>
              </div>
            </article>
          </li>
        )
      })}
    </ol>
  )
}

export function PatientInquiryConversation({
  composer,
  detail,
  error,
  now = new Date(),
  onBack,
  onClearFailed,
  onFileChange,
  onRetry,
  onRetrySend,
  onSend,
  onSubmitAppeal,
  onSubmitReport,
  onTextChange,
  status,
}: PatientInquiryConversationProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const reportReturnFocusRef = React.useRef<HTMLElement>(null)
  const [reportTarget, setReportTarget] = React.useState<InquiryReportTarget>()
  const [appealCaseId, setAppealCaseId] = React.useState<string>()
  const openReport = React.useCallback((target: InquiryReportTarget, returnFocusElement?: HTMLElement | null) => {
    reportReturnFocusRef.current = returnFocusElement ?? null
    setReportTarget(target)
  }, [])
  const errorHeadingRef = React.useRef<HTMLHeadingElement>(null)
  const conversationHeadingRef = React.useRef<HTMLHeadingElement>(null)
  const restrictionHeadingRef = React.useRef<HTMLHeadingElement>(null)
  const timelineRef = React.useRef<HTMLDivElement>(null)
  const previousDetailRef = React.useRef<{ id?: string; length: number }>({ length: 0 })
  const previousSendStatusRef = React.useRef(composer.sendStatus)
  const [announcement, setAnnouncement] = React.useState('')
  const [hasNewMessages, setHasNewMessages] = React.useState(false)

  const firstUnreadId = React.useMemo(() => {
    if (!detail?.unread.count) return undefined
    const clinicMessages = detail.timeline.filter(
      (item) => item.kind === 'external-message' && !item.actor.isCurrentActor,
    )
    return clinicMessages.slice(-detail.unread.count)[0]?.id
  }, [detail])

  const scrollTimelineToEnd = React.useCallback(() => {
    const timeline = timelineRef.current
    if (!timeline) return
    if (typeof timeline.scrollTo === 'function') timeline.scrollTo({ behavior: 'smooth', top: timeline.scrollHeight })
    else timeline.scrollTop = timeline.scrollHeight
    setHasNewMessages(false)
  }, [])

  React.useEffect(() => {
    if (!composer.file && fileInputRef.current) fileInputRef.current.value = ''
  }, [composer.file])

  React.useEffect(() => {
    if (status === 'error') errorHeadingRef.current?.focus()
  }, [status])

  React.useEffect(() => {
    const previous = previousSendStatusRef.current
    previousSendStatusRef.current = composer.sendStatus
    if ((previous === 'sending' || previous === 'uploading') && composer.sendStatus === 'idle' && !composer.error) {
      setAnnouncement('Message sent.')
    } else if (composer.sendStatus === 'uploading') {
      setAnnouncement('Uploading attachment.')
    }
  }, [composer.error, composer.sendStatus])

  React.useEffect(() => {
    if (!detail || status !== 'ready') return
    const timeline = timelineRef.current
    if (!timeline) return
    const previous = previousDetailRef.current
    const changedInquiry = previous.id !== detail.id
    const added = !changedInquiry && detail.timeline.length > previous.length
    const lastItem = detail.timeline.at(-1)
    const patientSent = lastItem?.kind === 'external-message' && lastItem.actor.isCurrentActor
    const nearEnd = timeline.scrollHeight - timeline.scrollTop - timeline.clientHeight < 72
    previousDetailRef.current = { id: detail.id, length: detail.timeline.length }

    window.requestAnimationFrame(() => {
      if (changedInquiry) {
        const unread = timeline.querySelector<HTMLElement>('[data-first-unread="true"]')
        if (unread && typeof unread.scrollIntoView === 'function') unread.scrollIntoView({ block: 'start' })
        else timeline.scrollTop = timeline.scrollHeight
        setHasNewMessages(false)
      } else if (added && (patientSent || nearEnd)) {
        scrollTimelineToEnd()
      } else if (added) {
        setHasNewMessages(true)
        setAnnouncement('New clinic message received.')
      }
    })
  }, [detail, scrollTimelineToEnd, status])

  if (status === 'loading' || status === 'idle') {
    return (
      <section
        aria-label="Loading inquiry conversation"
        aria-busy="true"
        className="min-h-[34rem] animate-pulse rounded-xl border border-border bg-card p-6"
      >
        <div className="h-20 rounded-[4px] bg-muted" />
        <div className="mt-12 h-24 w-3/5 rounded-[4px] bg-muted" />
        <div className="mt-8 ml-auto h-20 w-1/2 rounded-[4px] bg-muted" />
      </section>
    )
  }

  if (status === 'error' || !detail) {
    return (
      <section className="flex min-h-[34rem] flex-col items-center justify-center rounded-xl border border-border bg-card px-6 text-center">
        <AlertCircle className="mb-4 size-12 text-destructive" aria-hidden="true" />
        <Heading
          ref={errorHeadingRef}
          as="h2"
          align="center"
          size="h5"
          className="text-xl text-secondary"
          tabIndex={-1}
        >
          We couldn’t load this inquiry
        </Heading>
        <p className="mt-2 text-muted-foreground">{error ?? 'Check your connection and try again.'}</p>
        <Button className="mt-6 min-h-11" onClick={onRetry}>
          Try again
        </Button>
      </section>
    )
  }

  const closed = detail.lifecycle === 'closed'
  const replyAllowed = !closed && detail.actions.canReply
  const busy = composer.sendStatus === 'sending' || composer.sendStatus === 'uploading'
  const canSend = !busy && !composer.fileError && Boolean(composer.text.trim() || composer.file)
  const restriction =
    detail.moderation?.identity.state === 'messaging-suspended'
      ? detail.moderation.identity
      : detail.moderation?.conversation.state === 'restricted'
        ? detail.moderation.conversation
        : undefined

  return (
    <section
      className="flex h-[calc(100dvh-7.5rem)] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xs lg:h-auto lg:min-h-[34rem]"
      aria-label={`Conversation with ${detail.clinic.displayName}`}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      <header className="flex shrink-0 items-center gap-4 border-b border-border px-4 py-4 sm:px-6">
        <Link
          href="/patient/inquiries"
          className="inline-flex size-11 items-center justify-center rounded-lg text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden lg:hidden"
          onClick={onBack}
          aria-label="Back to my inquiries"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-secondary"
        >
          {getInitials(detail.clinic.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <Heading
            ref={conversationHeadingRef}
            as="h2"
            align="left"
            className="truncate text-lg text-foreground"
            data-patient-inquiry-detail-focus
            size="h5"
            tabIndex={-1}
          >
            {detail.clinic.displayName}
          </Heading>
          {detail.originalRequest.contentState !== 'hard-deleted' ? (
            <p className="truncate text-sm text-muted-foreground">{detail.interest.label}</p>
          ) : null}
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'inline-flex rounded-md px-2 py-1 text-xs font-semibold',
                closed ? 'bg-muted text-muted-foreground' : 'bg-success/10 text-success',
              )}
            >
              {closed ? 'Closed' : 'Open'}
            </span>
            {detail.moderation?.conversation.state === 'restricted' ? (
              <span className="inline-flex items-center gap-1.5 rounded-md bg-warning/15 px-2 py-1 text-xs font-semibold text-foreground">
                <LockKeyhole className="size-3.5" aria-hidden="true" /> Restricted
              </span>
            ) : null}
          </span>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-11"
          aria-label="Report conversation"
          onClick={(event) =>
            openReport(
              {
                inquiryId: detail.id,
                label: 'conversation',
                preview: `Conversation with ${detail.clinic.displayName}`,
                targetId: detail.binding.kind === 'patient' ? detail.binding.conversationId : detail.id,
                targetType: 'conversation',
              },
              event.currentTarget,
            )
          }
        >
          <Flag className="size-5" aria-hidden="true" />
        </Button>
      </header>

      {restriction ? (
        <div className="shrink-0 border-b border-warning/30 bg-warning/10 px-5 py-4 sm:px-7" role="status">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
            <div className="text-sm leading-6">
              <Heading
                ref={restrictionHeadingRef}
                as="h3"
                align="left"
                size="h6"
                className="text-sm font-semibold text-foreground"
                tabIndex={-1}
              >
                {detail.moderation?.identity.state === 'messaging-suspended'
                  ? 'Messaging is suspended for this account'
                  : 'Messaging in this conversation is restricted'}
              </Heading>
              <p className="text-muted-foreground">
                {restriction.isCurrentActorAffected
                  ? `findmydoc applied this restriction · ${categoryLabel(restriction.category)}`
                  : 'findmydoc restricted the other participant. You can still read the conversation.'}
              </p>
              {restriction.isCurrentActorAffected && restriction.effectiveUntil ? (
                <p className="text-muted-foreground">
                  Until {new Date(restriction.effectiveUntil).toLocaleString('en-GB')}
                </p>
              ) : null}
              {restriction.isCurrentActorAffected && restriction.appeal?.state === 'available' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="link"
                  className="min-h-11 px-0"
                  onClick={() => setAppealCaseId(restriction.appeal?.caseId)}
                >
                  Appeal decision
                </Button>
              ) : restriction.isCurrentActorAffected && restriction.appeal?.state === 'submitted' ? (
                <p className="font-medium text-foreground">Appeal submitted</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!detail.clinic.messagingAvailable ? (
        <div className="shrink-0 border-b border-border bg-muted/35 px-5 py-4 sm:px-7" role="status">
          <div className="flex items-start gap-3">
            <Building2 className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="text-sm leading-6">
              <p className="font-semibold text-foreground">This clinic is no longer available for messages</p>
              <p className="text-muted-foreground">Your previous inquiry and messages remain available to read.</p>
            </div>
          </div>
        </div>
      ) : null}

      <details className="group shrink-0 border-b border-border bg-muted/20 px-5 py-4 sm:px-7">
        <summary className="cursor-pointer text-sm font-semibold text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden">
          Original request
        </summary>
        <div className="pt-3">
          {detail.originalRequest.contentState === 'hard-deleted' ? (
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <ShieldAlert className="size-4" aria-hidden="true" /> Inquiry deleted
            </p>
          ) : detail.originalRequest.message ? (
            <p className="text-sm leading-6 whitespace-pre-wrap text-foreground">
              {plainTextWithLinks(detail.originalRequest.message)}
            </p>
          ) : null}
          {detail.originalRequest.contentState !== 'hard-deleted' &&
          (detail.originalRequest.preferredContactWindow || detail.originalRequest.treatmentTimeline) ? (
            <dl className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
              {detail.originalRequest.preferredContactWindow ? (
                <div>
                  <dt className="font-medium text-foreground">Preferred contact window</dt>
                  <dd>{formatInquiryRequestOption(detail.originalRequest.preferredContactWindow)}</dd>
                </div>
              ) : null}
              {detail.originalRequest.treatmentTimeline ? (
                <div>
                  <dt className="font-medium text-foreground">Treatment timeline</dt>
                  <dd>{formatInquiryRequestOption(detail.originalRequest.treatmentTimeline)}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </details>

      <div
        ref={timelineRef}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain"
        onScroll={(event) => {
          const target = event.currentTarget
          if (target.scrollHeight - target.scrollTop - target.clientHeight < 72) setHasNewMessages(false)
        }}
      >
        <Timeline
          detail={detail}
          firstUnreadId={firstUnreadId}
          now={now}
          onAppeal={setAppealCaseId}
          onReport={openReport}
        />
        {hasNewMessages ? (
          <Button
            type="button"
            size="sm"
            className="sticky bottom-3 left-1/2 min-h-11 -translate-x-1/2 shadow-lg"
            onClick={scrollTimelineToEnd}
          >
            New messages
          </Button>
        ) : null}
      </div>

      {closed ? (
        <div className="flex shrink-0 items-start gap-4 border-t border-border px-5 py-6 sm:px-7">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </span>
          <div>
            <Heading as="h3" align="left" size="h6" className="text-base text-foreground">
              This inquiry is closed
            </Heading>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              You can read previous messages. Only the clinic can reopen this inquiry.
            </p>
          </div>
        </div>
      ) : !replyAllowed ? (
        <div className="shrink-0 border-t border-border px-5 py-6 text-sm text-muted-foreground sm:px-7">
          {detail.clinic.messagingAvailable
            ? 'Replies are unavailable for this inquiry.'
            : 'This conversation is read-only because the clinic is no longer available.'}
        </div>
      ) : (
        <div className="shrink-0 border-t border-border bg-card px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {composer.sendStatus === 'ambiguous' || composer.sendStatus === 'error' ? (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle className="size-5" aria-hidden="true" />
              <span className="flex-1">{composer.error ?? 'Not sent'}</span>
              <Button
                className="min-h-11"
                size="sm"
                variant="outline"
                onClick={onRetrySend}
                disabled={composer.sendStatus === 'ambiguous' && !composer.retryReady}
              >
                Try again
              </Button>
              <Button className="min-h-11" size="sm" variant="ghost" onClick={onClearFailed}>
                Delete
              </Button>
            </div>
          ) : null}

          {composer.file || composer.fileError ? (
            <div
              className={cn(
                'mb-4 flex items-start gap-3 rounded-lg border p-3',
                composer.fileError ? 'border-destructive/40 bg-destructive/5' : 'border-border',
              )}
            >
              {composer.fileError ? (
                <AlertCircle className="size-6 text-destructive" aria-hidden="true" />
              ) : (
                <FileImage className="size-7 text-primary" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{composer.file?.name ?? 'Invalid attachment'}</p>
                {composer.file ? (
                  <p className="text-sm text-muted-foreground">{formatBytes(composer.file.size)}</p>
                ) : null}
                {composer.sendStatus === 'uploading' ? (
                  <div className="mt-2 space-y-1 text-sm text-primary">
                    <p className="inline-flex items-center gap-2">
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                      {typeof composer.uploadProgress === 'number'
                        ? `Uploading… ${composer.uploadProgress}%`
                        : 'Uploading…'}
                    </p>
                    <progress
                      aria-label="Attachment upload progress"
                      className="block h-2 w-full accent-primary"
                      max={100}
                      value={composer.uploadProgress}
                    />
                  </div>
                ) : null}
                {composer.fileError ? (
                  <p id="patient-inquiry-file-error" role="alert" className="mt-1 text-sm text-destructive">
                    {composer.fileError}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, WebP or PDF · Maximum 5 MB</p>
              </div>
              <button
                type="button"
                aria-label="Remove attachment"
                className="inline-flex size-11 items-center justify-center rounded-lg hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
                disabled={busy}
                onClick={() => onFileChange(undefined)}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-end gap-3 max-[374px]:grid-cols-[3rem_minmax(0,1fr)]">
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Attachment"
              className="sr-only"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              aria-describedby={composer.fileError ? 'patient-inquiry-file-error' : undefined}
              aria-invalid={composer.fileError ? true : undefined}
              onChange={(event) => onFileChange(event.target.files?.[0])}
            />
            <Button
              size="icon"
              variant="outline"
              className="size-12 rounded-lg max-[374px]:col-start-1 max-[374px]:row-start-2"
              aria-label="Attach a file"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-5" aria-hidden="true" />
            </Button>
            <Textarea
              aria-label="Message"
              className="min-h-12 resize-none rounded-lg py-3 max-[374px]:col-span-2 max-[374px]:row-start-1"
              maxLength={3000}
              placeholder="Write a message"
              value={composer.text}
              disabled={busy}
              onChange={(event) => onTextChange(event.target.value)}
            />
            <Button
              className="h-12 min-w-20 max-[374px]:col-start-2 max-[374px]:row-start-2 max-[374px]:justify-self-end"
              disabled={!canSend}
              onClick={onSend}
            >
              {busy ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      )}
      <InquiryReportDialog
        open={Boolean(reportTarget)}
        returnFocusElement={reportReturnFocusRef.current}
        target={reportTarget}
        onFallbackFocus={() => conversationHeadingRef.current?.focus()}
        onOpenChange={(open) => {
          if (!open) setReportTarget(undefined)
        }}
        onSubmit={(values) =>
          reportTarget
            ? onSubmitReport(reportTarget, values)
            : Promise.resolve({ error: 'No report target.', ok: false })
        }
      />
      <InquiryAppealDialog
        caseId={appealCaseId}
        open={Boolean(appealCaseId)}
        onFallbackFocus={() => {
          if (restrictionHeadingRef.current?.isConnected) restrictionHeadingRef.current.focus()
          else conversationHeadingRef.current?.focus()
        }}
        onOpenChange={(open) => {
          if (!open) setAppealCaseId(undefined)
        }}
        onSubmit={(values) =>
          appealCaseId ? onSubmitAppeal(appealCaseId, values) : Promise.resolve({ error: 'No appeal case.', ok: false })
        }
      />
    </section>
  )
}
