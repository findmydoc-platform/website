'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/atoms/avatar'
import { Button } from '@/components/atoms/button'
import { Heading } from '@/components/atoms/Heading'
import { Input } from '@/components/atoms/input'
import { Textarea } from '@/components/atoms/textarea'
import { cn } from '@/utilities/ui'
import { FileImage, FileText, MoreVertical, Paperclip, Search, Send, Smile, Sparkles, Stethoscope } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'

import { PatientProfileDialog } from './ClinicDashboardDialogs'
import { ClinicDashboardShell } from './ClinicDashboardShell'
import type {
  ChatMessage,
  ClinicDashboardAction,
  ClinicDashboardShellData,
  MessagesWorkspaceData,
  PatientProfileData,
} from './types'

type ClinicMessagesWorkspaceProps = {
  data: MessagesWorkspaceData
  mobileNavigationOpen?: boolean
  onAction?: (action: ClinicDashboardAction) => void
  onMobileNavigationOpenChange?: (open: boolean) => void
  onPatientProfileOpenChange?: (open: boolean) => void
  patientProfile: PatientProfileData
  patientProfileOpen?: boolean
  shell: ClinicDashboardShellData
}

function ConversationList({ data, onAction }: Pick<ClinicMessagesWorkspaceProps, 'data' | 'onAction'>) {
  return (
    <section
      aria-labelledby="conversation-list-title"
      className="flex min-w-0 flex-col border-r bg-card lg:w-[380px] lg:shrink-0"
    >
      <div className="space-y-4 border-b p-5">
        <div className="flex items-center justify-between gap-3">
          <Heading align="left" as="h2" className="text-xl" id="conversation-list-title" size="h5">
            Nachrichten
          </Heading>
          <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold text-primary-foreground">
            {data.newCountLabel}
          </span>
        </div>
        <div className="relative">
          <Search aria-hidden="true" className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-foreground/70" />
          <Input aria-label="Patienten suchen" className="pl-10" placeholder={data.searchPlaceholder} type="search" />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {(['new', 'recent'] as const).map((section) => (
          <div key={section}>
            <div className="border-b bg-muted/60 px-5 py-2 text-[10px] font-bold tracking-wide text-foreground/70 uppercase">
              {section === 'new' ? 'Neue Anfragen' : 'Letzte Chats'}
            </div>
            <div>
              {data.conversations
                .filter((conversation) => conversation.section === section)
                .map((conversation) => {
                  const selected = conversation.id === data.activeConversationId
                  return (
                    <Button
                      aria-current={selected ? 'page' : undefined}
                      className={cn(
                        'h-auto w-full justify-start rounded-none border-b px-5 py-4 text-left whitespace-normal',
                        selected ? 'border-l-4 border-l-primary bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/70',
                      )}
                      key={conversation.id}
                      onClick={() => onAction?.('select-conversation')}
                      size="clear"
                      variant="ghost"
                    >
                      <Avatar className="mr-4 size-12 shrink-0">
                        <AvatarImage alt={conversation.avatar.alt} src={conversation.avatar.src} />
                        <AvatarFallback>{conversation.name.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <span className="min-w-0 flex-1">
                        <span className="mb-1 flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-bold">{conversation.name}</span>
                          <span className="shrink-0 text-[11px] text-foreground/70">{conversation.timestamp}</span>
                        </span>
                        <span className="block truncate text-sm text-foreground/70">{conversation.preview}</span>
                        {conversation.category ? (
                          <span className="mt-2 flex items-center gap-2">
                            <span className="rounded-full bg-accent/20 px-2 py-1 text-[10px] font-bold text-accent-foreground uppercase">
                              {conversation.category}
                            </span>
                            {conversation.unreadCount ? (
                              <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                                {conversation.unreadCount}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </span>
                    </Button>
                  )
                })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const fromClinic = message.sender === 'clinic'
  return (
    <div className={cn('flex', fromClinic ? 'justify-end' : 'justify-start')}>
      <div className="max-w-[90%] sm:max-w-[70%]">
        <div
          className={cn(
            'rounded-xl border p-4 text-sm leading-6 shadow-xs',
            fromClinic ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-foreground',
          )}
        >
          <p>{message.body}</p>
          {message.attachments?.length ? (
            <div className="mt-3 grid grid-cols-2 gap-2 overflow-hidden rounded-lg bg-background/90 p-2">
              {message.attachments.map((attachment) => (
                <Image
                  alt={attachment.alt}
                  className="aspect-video w-full rounded-md object-cover"
                  height={120}
                  key={attachment.src}
                  loading="eager"
                  src={attachment.src}
                  width={180}
                />
              ))}
              {message.additionalAttachmentCount ? (
                <div className="flex aspect-video items-center justify-center gap-2 rounded-md border bg-muted text-sm font-bold text-foreground/70">
                  <FileImage aria-hidden="true" className="size-5" /> {message.additionalAttachmentCount}+ Fotos
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className={cn('mt-1 flex gap-2 text-[11px] text-foreground/70', fromClinic && 'justify-end')}>
          {message.readReceipt ? <span>{message.readReceipt}</span> : null}
          <span>{message.timestamp}</span>
        </div>
      </div>
    </div>
  )
}

function MessageThread({
  data,
  onAction,
  onOpenPatientProfile,
}: Pick<ClinicMessagesWorkspaceProps, 'data' | 'onAction'> & { onOpenPatientProfile: () => void }) {
  const [draft, setDraft] = useState('')
  const patientInitials = data.patientName
    .split(' ')
    .map((part) => part.at(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <section aria-labelledby="active-conversation-title" className="flex min-w-0 flex-1 flex-col bg-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative shrink-0">
            <Avatar className="size-12">
              <AvatarImage alt={data.patientAvatar.alt} src={data.patientAvatar.src} />
              <AvatarFallback>{patientInitials}</AvatarFallback>
            </Avatar>
            <span
              aria-hidden="true"
              className={cn(
                'absolute right-0 bottom-0 size-3 rounded-full border-2 border-card',
                data.patientStatus === 'online' ? 'bg-accent' : 'bg-foreground/45',
              )}
            />
            <span className="sr-only">{data.patientStatus === 'online' ? 'Online' : 'Offline'}</span>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Heading align="left" as="h2" className="truncate text-xl" id="active-conversation-title" size="h5">
                {data.patientName}
              </Heading>
              <span className="rounded bg-warning/70 px-2 py-1 text-[10px] font-bold text-secondary uppercase">
                {data.requestStatusLabel}
              </span>
            </div>
            <p className="mt-1 flex items-center gap-1 text-sm text-foreground/70">
              <Stethoscope aria-hidden="true" className="size-4" /> Interesse:{' '}
              <strong className="text-foreground">{data.interest}</strong>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-2" onClick={onOpenPatientProfile} size="sm" variant="secondary">
            <FileText aria-hidden="true" className="size-4" /> Patientenakte ansehen
          </Button>
          <Button
            aria-label="Unterhaltungsmenü öffnen"
            onClick={() => onAction?.('open-conversation-menu')}
            size="icon"
            variant="outline"
          >
            <MoreVertical aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </div>

      <div
        aria-label="Nachrichtenverlauf"
        className="min-h-0 flex-1 space-y-6 overflow-y-auto bg-muted/25 p-4 sm:p-6"
        tabIndex={0}
      >
        <div className="flex justify-center">
          <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-bold tracking-wide text-foreground/70 uppercase">
            {data.dateLabel}
          </span>
        </div>
        {data.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <p className="text-center text-xs text-foreground/70">{data.typingLabel}</p>
      </div>

      <div className="border-t bg-card p-4 sm:p-5">
        <div className="flex items-end gap-2">
          <Button aria-label="Datei anhängen" onClick={() => onAction?.('attach-file')} size="icon" variant="ghost">
            <Paperclip aria-hidden="true" className="size-5" />
          </Button>
          <Button
            aria-label="Emoji auswählen"
            onClick={() => onAction?.('add-internal-note')}
            size="icon"
            variant="ghost"
          >
            <Smile aria-hidden="true" className="size-5" />
          </Button>
          <Textarea
            aria-label="Nachricht"
            className="min-h-10 resize-none rounded-lg"
            onChange={(event) => setDraft(event.target.value)}
            placeholder={data.composer.placeholder}
            rows={1}
            value={draft}
          />
          <Button
            aria-label="Nachricht senden"
            onClick={() => {
              onAction?.('send-message')
              setDraft('')
            }}
            size="icon"
            variant="primary"
          >
            <Send aria-hidden="true" className="size-5" />
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap gap-3">
            <Button
              className="h-auto gap-1 p-0 text-xs"
              onClick={() => onAction?.('use-template')}
              size="clear"
              variant="link"
            >
              <Sparkles aria-hidden="true" className="size-3" /> {data.composer.templateLabel}
            </Button>
            <Button
              className="h-auto p-0 text-xs"
              onClick={() => onAction?.('add-internal-note')}
              size="clear"
              variant="link"
            >
              {data.composer.internalNoteLabel}
            </Button>
          </div>
          <span className="text-foreground/70">
            {data.patientStatus === 'online' ? data.composer.onlineLabel : 'Der Patient ist gerade offline'}
          </span>
        </div>
      </div>
    </section>
  )
}

export function ClinicMessagesWorkspace({
  data,
  mobileNavigationOpen,
  onAction,
  onMobileNavigationOpenChange,
  onPatientProfileOpenChange,
  patientProfile,
  patientProfileOpen,
  shell,
}: ClinicMessagesWorkspaceProps) {
  const [internalProfileOpen, setInternalProfileOpen] = useState(false)
  const resolvedProfileOpen = patientProfileOpen ?? internalProfileOpen
  const setProfileOpen = onPatientProfileOpenChange ?? setInternalProfileOpen
  const headerActions = (
    <>
      <Button onClick={() => onAction?.('edit-profile')} size="sm" variant="primary">
        Profil bearbeiten
      </Button>
      <Button onClick={() => onAction?.('open-public-profile')} size="sm" variant="secondary">
        Öffentliches Profil
      </Button>
    </>
  )

  return (
    <>
      <ClinicDashboardShell
        activeSection="messages"
        contentClassName="p-0"
        data={shell}
        headerActions={headerActions}
        mobileNavigationOpen={mobileNavigationOpen}
        onAction={onAction}
        onMobileNavigationOpenChange={onMobileNavigationOpenChange}
      >
        <Heading align="left" as="h1" className="sr-only" size="h1">
          Nachrichten
        </Heading>
        <div className="grid min-h-[calc(100svh-8rem)] grid-cols-1 lg:flex lg:h-[calc(100svh-4rem)] lg:min-h-0 lg:overflow-hidden">
          <ConversationList data={data} onAction={onAction} />
          <MessageThread
            data={data}
            onAction={onAction}
            onOpenPatientProfile={() => {
              onAction?.('open-patient-profile')
              setProfileOpen(true)
            }}
          />
        </div>
      </ClinicDashboardShell>
      <PatientProfileDialog
        data={patientProfile}
        onOpenChange={(open) => {
          setProfileOpen(open)
          if (!open) onAction?.('close-patient-profile')
        }}
        open={resolvedProfileOpen}
      />
    </>
  )
}
