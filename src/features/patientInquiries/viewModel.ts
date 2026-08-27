import type { InquiryDetailDTO, InquiryTimelineItemDTO } from '@/features/inquiryCommunication/contracts'

export type PatientInquiryTimelineItemView = InquiryTimelineItemDTO & {
  attachmentDownloadHref?: string
}

export type PatientInquiryDetailView = Omit<InquiryDetailDTO, 'timeline'> & {
  timeline: PatientInquiryTimelineItemView[]
}
