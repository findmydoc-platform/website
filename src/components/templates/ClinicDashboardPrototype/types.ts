export type ClinicDashboardSection = 'dashboard' | 'messages' | 'profile' | 'reviews'

export type ClinicDashboardRange = '30' | '7' | '90'

export type ClinicDashboardMedia = {
  alt: string
  src: string
}

export type ClinicDashboardShellData = {
  adminAvatar: ClinicDashboardMedia
  adminName: string
  clinicName: string
}

export type ClinicDashboardAction =
  | 'activate-doctor-profile'
  | 'add-clinic'
  | 'add-gallery-image'
  | 'add-internal-note'
  | 'add-review-note'
  | 'add-specialty'
  | 'add-team-member'
  | 'add-treatment'
  | 'appeal-review'
  | 'attach-file'
  | 'cancel-profile-edit'
  | 'cancel-team-member'
  | 'cancel-treatment'
  | 'change-gallery-image'
  | 'change-review-page'
  | 'check-certificate'
  | 'choose-team-photo'
  | 'close-patient-profile'
  | 'contact-support'
  | 'create-appointment'
  | 'discard-profile-changes'
  | 'download-profile-views'
  | 'edit-map'
  | 'edit-opening-hours'
  | 'edit-profile'
  | 'edit-review-response'
  | 'edit-team-member'
  | 'export-reviews'
  | 'filter-reviews'
  | 'fix-profile-task'
  | 'flag-review'
  | 'navigate-dashboard'
  | 'navigate-messages'
  | 'navigate-profile'
  | 'navigate-reviews'
  | 'open-clinic-preview'
  | 'open-conversation-menu'
  | 'open-mobile-navigation'
  | 'open-notifications'
  | 'open-patient-profile'
  | 'open-profile-views-menu'
  | 'open-public-profile'
  | 'publish-profile-changes'
  | 'refresh-reviews'
  | 'remove-specialty'
  | 'remove-team-member'
  | 'reorder-treatment'
  | 'respond-to-review'
  | 'save-profile'
  | 'save-team-member'
  | 'save-treatment'
  | 'select-conversation'
  | 'select-period-30-days'
  | 'select-period-7-days'
  | 'select-period-90-days'
  | 'send-message'
  | 'show-review-history'
  | 'sign-out'
  | 'toggle-settings'
  | 'upload-certificate'
  | 'use-template'

export type DashboardMetric = {
  delta?: string
  description?: string
  icon: string
  id: string
  label: string
  progress?: number
  tooltip?: string
  trend?: 'down' | 'up'
  value: string
}

export type DashboardFunnelStep = {
  conversion?: string
  label: string
  value: string
}

export type DashboardProfileTask = {
  action: string
  label: string
  priority: 'high' | 'low' | 'medium'
}

export type DashboardOverviewData = {
  chart: {
    labels: string[]
    points: number[]
    summary: Array<{ label: string; value: string }>
  }
  clinicPreview: {
    image: ClinicDashboardMedia
    location: string
    name: string
  }
  funnel: DashboardFunnelStep[]
  metrics: DashboardMetric[]
  profileTasks: DashboardProfileTask[]
  range: ClinicDashboardRange
  rating: {
    categories: string[]
    count: number
    value: number
  }
}

export type ConversationListItem = {
  avatar: ClinicDashboardMedia
  category?: string
  id: string
  name: string
  preview: string
  section: 'new' | 'recent'
  timestamp: string
  unreadCount?: number
}

export type ChatMessage = {
  additionalAttachmentCount?: number
  attachments?: ClinicDashboardMedia[]
  body: string
  id: string
  readReceipt?: string
  sender: 'clinic' | 'patient'
  timestamp: string
}

export type MessagesWorkspaceData = {
  activeConversationId: string
  composer: {
    internalNoteLabel: string
    placeholder: string
    templateLabel: string
  }
  conversations: ConversationListItem[]
  dateLabel: string
  interest: string
  messages: ChatMessage[]
  newCountLabel: string
  patientAvatar: ClinicDashboardMedia
  patientName: string
  requestStatusLabel: string
  searchPlaceholder: string
}

export type PatientProfileData = {
  age: string
  avatar: ClinicDashboardMedia
  contactEmail: string
  gender: string
  interest: string
  lastVisit: string
  medicalNotes: string
  name: string
}

export type ReviewStatus = 'answered' | 'open' | 'under-review'

export type ReviewItem = {
  author: string
  body: string
  id: string
  initials: string
  notice?: string
  rating: number
  reference?: string
  relativeDate: string
  response?: {
    body: string
    label: string
  }
  status: ReviewStatus
  treatment: string
}

export type ReviewsManagementData = {
  filters: Array<{
    id: string
    label: string
    options: Array<{ label: string; value: string }>
    value: string
  }>
  pagination: {
    currentPage: number
    label: string
    totalPages: number
  }
  rating: number
  distribution: Array<{ count: number; percent: number; stars: number }>
  reviews: ReviewItem[]
  totalReviews: number
}

export type ClinicProfileTeamMember = {
  avatar: ClinicDashboardMedia
  id: string
  name: string
  specialty: string
}

export type ClinicProfileTreatment = {
  duration: string
  id: string
  name: string
  price: string
}

export type ClinicProfileData = {
  address: {
    city: string
    phone: string
    postalCode: string
    street: string
  }
  autosaveMessage: string
  breadcrumbs: string[]
  clinicDescription: string
  clinicName: string
  gallery: ClinicDashboardMedia[]
  openingHours: Array<{
    closed?: boolean
    days: string
    hours: string
  }>
  specialties: string[]
  team: ClinicProfileTeamMember[]
  treatments: ClinicProfileTreatment[]
}

export type TreatmentDialogData = {
  categories: string[]
  categoryPlaceholder: string
  descriptionPlaceholder: string
  durationPlaceholder: string
  namePlaceholder: string
  pricePlaceholder: string
}

export type TeamMemberDialogData = {
  biographyPlaceholder: string
  firstNamePlaceholder: string
  lastNamePlaceholder: string
  rolePlaceholder: string
  roles: string[]
  uploadHint: string
}

export type TreatmentCatalogItem = {
  category: string
  duration: string
  id: string
  name: string
  price: string
  status: string
}

export type ClinicProfileDialogBackdropData =
  | {
      clinicImage: ClinicDashboardMedia
      clinicName: string
      items: TreatmentCatalogItem[]
      title: string
      variant: 'treatments'
    }
  | {
      clinicName: string
      skeletonCount: number
      title: string
      variant: 'team'
    }
