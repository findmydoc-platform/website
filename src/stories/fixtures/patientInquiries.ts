import type {
  InquiryDetailDTO,
  InquiryListItemDTO,
  PatientInquiryQueueDTO,
} from '@/features/inquiryCommunication/contracts'
import { createInitialPatientInquiriesState, type PatientInquiriesState } from '@/features/patientInquiries/model'
import type { PatientInquiryDetailView } from '@/features/patientInquiries/viewModel'

const listItem = (overrides: Partial<InquiryListItemDTO>): InquiryListItemDTO => ({
  binding: {
    canReply: true,
    conversationId: 'conversation-izmir',
    kind: 'patient',
    patient: { displayName: 'Aylin Synthetic', id: 'patient-synthetic' },
  },
  clinic: { displayName: 'Izmir Coast Dental', id: 'clinic-izmir' },
  createdAt: '2026-08-24T08:00:00.000Z',
  handlingStatus: 'contacted',
  id: 'inquiry-izmir',
  interest: { label: 'Dental implants' },
  latestActivityKind: 'external-message',
  lastActivityAt: '2026-08-24T08:06:00.000Z',
  lifecycle: 'open',
  patientName: 'Aylin Synthetic',
  preview: 'Would Tuesday at 15:00 CET work for a video consultation?',
  revision: 4,
  unread: { count: 2, isUnread: true },
  ...overrides,
})

export const patientInquiryItems: InquiryListItemDTO[] = [
  listItem({}),
  listItem({
    clinic: { displayName: 'Antalya MedVista Clinic', id: 'clinic-antalya' },
    id: 'inquiry-antalya',
    interest: { label: 'Laser eye surgery' },
    lastActivityAt: '2026-08-23T14:24:00.000Z',
    preview: 'You: I can send the report tomorrow.',
    unread: { count: 0, isUnread: false },
  }),
  listItem({
    binding: {
      canReply: false,
      conversationId: 'conversation-ankara',
      kind: 'patient',
      patient: { displayName: 'Aylin Synthetic', id: 'patient-synthetic' },
    },
    clinic: { displayName: 'Ankara Harmony Dental', id: 'clinic-ankara' },
    id: 'inquiry-ankara',
    interest: { label: 'Dental crowns' },
    lastActivityAt: '2026-08-12T15:02:00.000Z',
    lifecycle: 'closed',
    preview: 'Your inquiry is closed.',
    unread: { count: 0, isUnread: false },
  }),
]

export const patientInquiryQueue: PatientInquiryQueueDTO = {
  changeCursor: 'queue-synthetic-1',
  counts: { all: 3, closed: 1, open: 2 },
  items: patientInquiryItems,
  unchanged: false,
  unreadCount: 1,
}

const detailBase: Omit<InquiryDetailDTO, 'timeline'> = {
  ...(patientInquiryItems[0] as InquiryListItemDTO),
  actions: {
    canAddInternalNote: false,
    canChangeHandlingStatus: false,
    canChangeLifecycle: false,
    canMarkRead: true,
    canMarkUnread: false,
    canReply: true,
    canRevealContact: false,
    canView: true,
  },
  attachmentConstraints: {
    acceptedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'],
    maxFileBytes: 5 * 1024 * 1024,
    maxFilesPerMessage: 1,
  },
  contact: { mode: 'collapsed' },
  originalRequest: { message: 'I would like to discuss dental implants.' },
}

export const activePatientInquiryDetail: PatientInquiryDetailView = {
  ...detailBase,
  timeline: [
    {
      actor: { displayName: 'Izmir Coast Dental', isCurrentActor: false, kind: 'clinic' },
      attachment: {
        fileName: 'treatment-plan.pdf',
        id: 'attachment-plan',
        mimeType: 'application/pdf',
        sizeBytes: 1_887_436,
      },
      attachmentDownloadHref: '/api/patient/inquiries/attachments/download?attachmentId=attachment-plan',
      createdAt: '2026-08-24T07:18:00.000Z',
      id: 'message-clinic-plan',
      kind: 'external-message',
      text: 'Thanks for your inquiry. Dr. Demir can review your scans before we confirm the treatment plan.',
    },
    {
      actor: { displayName: 'Aylin Synthetic', isCurrentActor: true, kind: 'patient' },
      attachment: {
        fileName: 'dental-xray.jpg',
        id: 'attachment-xray',
        mimeType: 'image/jpeg',
        sizeBytes: 2_516_582,
      },
      attachmentDownloadHref: '/api/patient/inquiries/attachments/download?attachmentId=attachment-xray',
      createdAt: '2026-08-24T07:42:00.000Z',
      id: 'message-patient-xray',
      kind: 'external-message',
      text: 'Thank you. I have attached my current X-ray.',
    },
    {
      actor: { displayName: 'Izmir Coast Dental', isCurrentActor: false, kind: 'clinic' },
      createdAt: '2026-08-24T08:06:00.000Z',
      id: 'message-clinic-time',
      kind: 'external-message',
      text: 'We received it. Would Tuesday at 15:00 CET work for a video consultation?',
    },
  ],
}

export const closedPatientInquiryDetail: PatientInquiryDetailView = {
  ...detailBase,
  ...(patientInquiryItems[2] as InquiryListItemDTO),
  actions: { ...detailBase.actions, canReply: false },
  timeline: [
    {
      actor: { displayName: 'Ankara Harmony Dental', isCurrentActor: false, kind: 'clinic' },
      createdAt: '2026-08-12T12:10:00.000Z',
      id: 'message-closed-clinic-1',
      kind: 'external-message',
      text: 'Thank you for sending the photos. We have reviewed your request.',
    },
    {
      actor: { displayName: 'Aylin Synthetic', isCurrentActor: true, kind: 'patient' },
      createdAt: '2026-08-12T12:34:00.000Z',
      id: 'message-closed-patient',
      kind: 'external-message',
      text: 'Thanks. I will consider the treatment plan and get back to you.',
    },
    {
      actor: { displayName: 'Ankara Harmony Dental', isCurrentActor: false, kind: 'clinic' },
      createdAt: '2026-08-12T13:02:00.000Z',
      id: 'message-closed-clinic-2',
      kind: 'external-message',
      text: 'Of course. You can continue here if the inquiry is reopened.',
    },
  ],
}

export const restrictedPatientInquiryDetail: PatientInquiryDetailView = {
  ...detailBase,
  actions: { ...detailBase.actions, canReply: false },
  binding: { ...detailBase.binding, canReply: false },
  moderation: {
    conversation: {
      appeal: { caseId: 'moderation-case-synthetic', state: 'available' },
      category: 'privacy-concern',
      effectiveUntil: '2026-08-28T12:00:00.000Z',
      isCurrentActorAffected: true,
      state: 'restricted',
    },
    identity: { state: 'available' },
  },
  timeline: [
    activePatientInquiryDetail.timeline[0]!,
    {
      actor: { displayName: 'Aylin Synthetic', isCurrentActor: true, kind: 'patient' },
      contentState: 'restricted',
      createdAt: '2026-08-24T07:42:00.000Z',
      id: 'message-patient-restricted',
      kind: 'external-message',
      moderation: {
        appeal: { caseId: 'moderation-case-content', state: 'submitted' },
        category: 'privacy-concern',
        isCurrentActorAffected: true,
      },
    },
    {
      actor: { displayName: 'System', isCurrentActor: false, kind: 'system' },
      createdAt: '2026-08-24T08:10:00.000Z',
      event: 'moderation-restricted',
      id: 'event-moderation-restricted',
      kind: 'system-event',
    },
  ],
}

export const restrictedAttachmentPatientInquiryDetail: PatientInquiryDetailView = {
  ...activePatientInquiryDetail,
  timeline: activePatientInquiryDetail.timeline.map((item, index) =>
    index === 0 && item.kind === 'external-message'
      ? {
          ...item,
          attachment: undefined,
          attachmentDownloadHref: undefined,
          attachmentModeration: { isCurrentActorAffected: false },
          attachmentState: 'restricted',
        }
      : item,
  ),
}

export const identitySuspendedPatientInquiryDetail: PatientInquiryDetailView = {
  ...activePatientInquiryDetail,
  actions: { ...activePatientInquiryDetail.actions, canReply: false },
  binding: { ...activePatientInquiryDetail.binding, canReply: false },
  moderation: {
    conversation: { state: 'available' },
    identity: {
      appeal: { caseId: 'moderation-case-identity', state: 'available' },
      category: 'harassment-threats',
      effectiveUntil: '2026-08-30T12:00:00.000Z',
      isCurrentActorAffected: true,
      state: 'messaging-suspended',
    },
  },
}

export const otherParticipantRestrictedPatientInquiryDetail: PatientInquiryDetailView = {
  ...restrictedPatientInquiryDetail,
  moderation: {
    conversation: { isCurrentActorAffected: false, state: 'restricted' },
    identity: { state: 'available' },
  },
}

export const appealSubmittedPatientInquiryDetail: PatientInquiryDetailView = {
  ...restrictedPatientInquiryDetail,
  moderation: {
    conversation: {
      ...restrictedPatientInquiryDetail.moderation?.conversation,
      appeal: { caseId: 'moderation-case-synthetic', state: 'submitted' },
      isCurrentActorAffected: true,
      state: 'restricted',
    },
    identity: { state: 'available' },
  },
}

export const restoredPatientInquiryDetail: PatientInquiryDetailView = {
  ...activePatientInquiryDetail,
  timeline: [
    ...activePatientInquiryDetail.timeline,
    {
      actor: { displayName: 'System', isCurrentActor: false, kind: 'system' },
      createdAt: '2026-08-24T09:12:00.000Z',
      event: 'moderation-restored',
      id: 'event-moderation-restored',
      kind: 'system-event',
    },
  ],
}

export const activePatientInquiryState = (): PatientInquiriesState => ({
  ...createInitialPatientInquiriesState('inquiry-izmir'),
  detail: { changeCursor: 'detail-synthetic-1', data: activePatientInquiryDetail, status: 'ready' },
  queue: { data: patientInquiryQueue, status: 'ready' },
})
