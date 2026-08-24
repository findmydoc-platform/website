'use client'

import {
  AlertCircle,
  ArrowLeft,
  Download,
  File,
  FileImage,
  LoaderCircle,
  LockKeyhole,
  Paperclip,
  X,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/atoms/button'
import { Textarea } from '@/components/atoms/textarea'
import type { PatientInquiryComposerState } from '@/features/patientInquiries/model'
import type { PatientInquiryDetailView, PatientInquiryTimelineItemView } from '@/features/patientInquiries/viewModel'
import { cn } from '@/utilities/ui'

type PatientInquiryConversationProps = {
  composer: PatientInquiryComposerState
  detail?: PatientInquiryDetailView
  error?: string
  onBack: () => void
  onClearFailed: () => void
  onFileChange: (file?: File) => void
  onRetry: () => void
  onRetrySend: () => void
  onSend: () => void
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

const formatDay = (value: string): string => {
  const date = new Date(value)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) return 'Today'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(date)
}

const formatBytes = (bytes: number): string =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

const Attachment = ({ item }: { item: PatientInquiryTimelineItemView }) => {
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
          className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden"
          href={item.attachmentDownloadHref}
          aria-label={`Download ${item.attachment.fileName}`}
        >
          <Download className="size-5" aria-hidden="true" />
        </a>
      ) : null}
    </div>
  )
}

const Timeline = ({ detail }: { detail: PatientInquiryDetailView }) => {
  const visibleTimeline = detail.timeline.filter((item) => item.kind !== 'internal-note')
  let lastDay = ''
  return (
    <div className="space-y-5 px-4 py-6 sm:px-6 lg:px-7">
      {visibleTimeline.map((item) => {
        const day = new Date(item.createdAt).toDateString()
        const showDay = day !== lastDay
        lastDay = day
        if (item.kind === 'system-event') {
          return (
            <React.Fragment key={item.id}>
              {showDay ? (
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  {formatDay(item.createdAt)}
                  <span className="h-px flex-1 bg-border" />
                </div>
              ) : null}
              <p className="text-center text-sm text-muted-foreground">
                {item.event === 'reopened' ? 'The clinic reopened this inquiry.' : 'The inquiry status changed.'}
              </p>
            </React.Fragment>
          )
        }
        if (item.kind !== 'external-message') return null
        const current = item.actor.isCurrentActor
        return (
          <React.Fragment key={item.id}>
            {showDay ? (
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {formatDay(item.createdAt)}
                <span className="h-px flex-1 bg-border" />
              </div>
            ) : null}
            <article className={cn('flex gap-3', current && 'justify-end')}>
              {!current ? (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-bold">
                  {getInitials(detail.clinic.displayName)}
                </span>
              ) : null}
              <div className={cn('max-w-[88%] sm:max-w-[75%]', current && 'ml-auto')}>
                <div className="mb-2 flex items-center justify-between gap-6 text-sm">
                  <strong>{current ? 'You' : 'Clinic'}</strong>
                  <time className="text-muted-foreground" dateTime={item.createdAt}>
                    {formatTime(item.createdAt)}
                  </time>
                </div>
                <div
                  className={cn(
                    'rounded-xl border px-4 py-3 text-[0.95rem] leading-7 [overflow-wrap:anywhere]',
                    current ? 'border-primary/25 bg-primary/5' : 'border-border bg-muted/35',
                  )}
                >
                  {item.text ? <p className="whitespace-pre-wrap">{item.text}</p> : null}
                  <Attachment item={item} />
                </div>
              </div>
            </article>
          </React.Fragment>
        )
      })}
    </div>
  )
}

export function PatientInquiryConversation({
  composer,
  detail,
  error,
  onBack,
  onClearFailed,
  onFileChange,
  onRetry,
  onRetrySend,
  onSend,
  onTextChange,
  status,
}: PatientInquiryConversationProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  if (status === 'loading' || status === 'idle') {
    return (
      <section
        aria-label="Loading inquiry conversation"
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
        <h2 className="text-xl font-bold text-secondary">We couldn’t load this inquiry</h2>
        <p className="mt-2 text-muted-foreground">{error ?? 'Check your connection and try again.'}</p>
        <Button className="mt-6" onClick={onRetry}>
          Try again
        </Button>
      </section>
    )
  }

  const closed = detail.lifecycle === 'closed'
  const replyAllowed = !closed && detail.actions.canReply
  const busy = composer.sendStatus === 'sending' || composer.sendStatus === 'uploading'
  const canSend = !busy && !composer.fileError && Boolean(composer.text.trim() || composer.file)

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card shadow-xs"
      aria-label={`Conversation with ${detail.clinic.displayName}`}
    >
      <header className="flex items-center gap-4 border-b border-border px-4 py-4 sm:px-6">
        <button
          type="button"
          className="inline-flex size-10 items-center justify-center rounded-lg text-primary focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-hidden lg:hidden"
          onClick={onBack}
          aria-label="Back to my inquiries"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </button>
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full border border-border bg-card text-sm font-bold text-secondary">
          {getInitials(detail.clinic.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-left text-lg font-bold text-foreground">{detail.clinic.displayName}</h2>
          <p className="truncate text-sm text-muted-foreground">{detail.interest.label}</p>
          <span
            className={cn(
              'mt-2 inline-flex rounded-md px-2 py-1 text-xs font-semibold',
              closed ? 'bg-muted text-muted-foreground' : 'bg-success/10 text-success',
            )}
          >
            {closed ? 'Closed' : 'Open'}
          </span>
        </div>
      </header>

      <div className="min-h-[24rem] lg:max-h-[calc(100svh-29rem)] lg:overflow-y-auto">
        <Timeline detail={detail} />
      </div>

      {closed ? (
        <div className="flex items-start gap-4 border-t border-border px-5 py-6 sm:px-7">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
            <LockKeyhole className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h3 className="text-left font-bold text-foreground">This inquiry is closed</h3>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              You can read previous messages. Only the clinic can reopen this inquiry.
            </p>
          </div>
        </div>
      ) : !replyAllowed ? (
        <div className="border-t border-border px-5 py-6 text-sm text-muted-foreground sm:px-7">
          Replies are unavailable for this inquiry.
        </div>
      ) : (
        <div className="border-t border-border bg-card px-4 py-4 sm:px-6">
          {composer.sendStatus === 'ambiguous' || composer.sendStatus === 'error' ? (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            >
              <AlertCircle className="size-5" aria-hidden="true" />
              <span className="flex-1">{composer.error ?? 'Not sent'}</span>
              <Button
                size="sm"
                variant="outline"
                onClick={onRetrySend}
                disabled={composer.sendStatus === 'ambiguous' && !composer.retryReady}
              >
                Try again
              </Button>
              <Button size="sm" variant="ghost" onClick={onClearFailed}>
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
                <AlertCircle className="size-6 text-destructive" />
              ) : (
                <FileImage className="size-7 text-primary" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{composer.file?.name ?? 'Invalid attachment'}</p>
                {composer.file ? (
                  <p className="text-sm text-muted-foreground">{formatBytes(composer.file.size)}</p>
                ) : null}
                {composer.sendStatus === 'uploading' ? (
                  <p className="mt-1 inline-flex items-center gap-2 text-sm text-primary">
                    <LoaderCircle className="size-4 animate-spin" /> Uploading…
                  </p>
                ) : null}
                {composer.fileError ? <p className="mt-1 text-sm text-destructive">{composer.fileError}</p> : null}
                <p className="mt-1 text-xs text-muted-foreground">PNG, JPEG, WebP or PDF · Maximum 5 MB</p>
              </div>
              <button
                type="button"
                aria-label="Remove attachment"
                className="rounded-lg p-2 hover:bg-muted"
                onClick={() => onFileChange(undefined)}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <div className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-end gap-3">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(event) => onFileChange(event.target.files?.[0])}
            />
            <Button
              size="icon"
              variant="outline"
              className="size-12 rounded-lg"
              aria-label="Attach a file"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="size-5" aria-hidden="true" />
            </Button>
            <Textarea
              aria-label="Message"
              className="min-h-12 resize-none rounded-lg py-3"
              maxLength={3000}
              placeholder="Write a message"
              value={composer.text}
              disabled={busy}
              onChange={(event) => onTextChange(event.target.value)}
            />
            <Button className="h-12 min-w-20" disabled={!canSend} onClick={onSend}>
              {busy ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
