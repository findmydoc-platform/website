import * as React from 'react'

import type { ContactFormFields, ContactFormMessage } from '@/components/organisms/ClinicDetail'
import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'
import {
  buildContactRequestMessage,
  computeNextVisibleFurtherTreatmentCount,
  resolveDoctorSelectionToggle,
  sanitizeSelectedId,
} from '@/components/templates/ClinicDetailConcepts/hooks/clinicDetailInteraction.logic'

type UseClinicDetailInteractionStateArgs = {
  clinicId: number
  clinicSlug: string
  doctors: ClinicDetailDoctor[]
  heroDoctors: ClinicDetailDoctor[]
  sortedTreatments: ClinicDetailTreatment[]
  initialContactFormFields: ContactFormFields
  furtherTreatmentPageSize: number
}

type ContactFormScrollOptions = {
  focus?: boolean
}

type UseClinicDetailInteractionStateResult = {
  ourDoctorsRef: React.RefObject<HTMLElement | null>
  contactFormRef: React.RefObject<HTMLElement | null>
  activeHeroDoctorId: string
  selectedDoctorId: string
  selectedTreatmentId: string
  activeCuratedIndex: number
  visibleFurtherTreatmentCount: number
  contactFormFields: ContactFormFields
  contactFormMessage: ContactFormMessage | null
  isContactSubmitting: boolean
  selectedDoctor: ClinicDetailDoctor | undefined
  selectedTreatment: ClinicDetailTreatment | undefined
  relatedActiveIndex: number | undefined
  setActiveCuratedIndex: React.Dispatch<React.SetStateAction<number>>
  scrollToContactForm: (options?: ContactFormScrollOptions) => void
  chooseTreatmentAndScroll: (treatmentId: string) => void
  showMoreFurtherTreatments: () => void
  toggleDoctorSelection: (doctorId: string) => void
  handleContactDoctor: (doctorId?: string) => void
  handleContactFieldChange: (field: keyof ContactFormFields, value: string) => void
  handleContactSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  handleRelatedDoctorIndexChange: (nextIndex: number) => void
  handleDoctorSelectionChange: (doctorId: string) => void
  handleTreatmentSelectionChange: (treatmentId: string) => void
  handleResetContactFields: () => void
  handleClearSelections: () => void
}

type ClinicInquirySubmitInput = {
  clinicId: number
  clinicSlug: string
  fields: ContactFormFields
  selectedDoctorId: string
  selectedDoctorName?: string
  selectedTreatmentId: string
  selectedTreatmentName?: string
}

const CONTACT_FORM_BRIDGE_SLUG = 'public-contact'

const normalizeFormValue = (value: string): string | undefined => {
  const normalized = value.trim()
  return normalized || undefined
}

const addOptionalFormValue = (payload: Record<string, string>, field: string, value: string): void => {
  const normalized = normalizeFormValue(value)
  if (normalized) {
    payload[field] = normalized
  }
}

const submitClinicInquiry = async ({
  clinicId,
  clinicSlug,
  fields,
  selectedDoctorId,
  selectedDoctorName,
  selectedTreatmentId,
  selectedTreatmentName,
}: ClinicInquirySubmitInput): Promise<void> => {
  const message =
    normalizeFormValue(fields.note) ??
    buildContactRequestMessage({
      doctorName: selectedDoctorName,
      treatmentName: selectedTreatmentName,
    })
  const payload: Record<string, string> = {
    clinic_id: String(clinicId),
    clinic_slug: clinicSlug,
    email: fields.email.trim(),
    form_context: 'clinic_profile_inquiry',
    message,
    name: fields.fullName.trim(),
    phone_number: fields.phoneNumber.trim(),
  }

  addOptionalFormValue(payload, 'preferred_date', fields.preferredDate)
  addOptionalFormValue(payload, 'preferred_time', fields.preferredTime)
  addOptionalFormValue(payload, 'doctor_id', selectedDoctorId)
  addOptionalFormValue(payload, 'treatment_id', selectedTreatmentId)

  const response = await fetch(`/api/form-bridge/${CONTACT_FORM_BRIDGE_SLUG}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    const errorMessage =
      typeof (errorPayload as { error?: unknown }).error === 'string'
        ? (errorPayload as { error: string }).error
        : 'Could not submit the contact request.'
    throw new Error(errorMessage)
  }
}

export function useClinicDetailInteractionState({
  clinicId,
  clinicSlug,
  doctors,
  heroDoctors,
  sortedTreatments,
  initialContactFormFields,
  furtherTreatmentPageSize,
}: UseClinicDetailInteractionStateArgs): UseClinicDetailInteractionStateResult {
  const [activeHeroDoctorId, setActiveHeroDoctorId] = React.useState('')
  const [selectedDoctorId, setSelectedDoctorId] = React.useState('')
  const [selectedTreatmentId, setSelectedTreatmentId] = React.useState('')
  const [activeCuratedIndex, setActiveCuratedIndex] = React.useState(0)
  const [visibleFurtherTreatmentCount, setVisibleFurtherTreatmentCount] = React.useState(furtherTreatmentPageSize)
  const [contactFormFields, setContactFormFields] = React.useState<ContactFormFields>(initialContactFormFields)
  const [contactFormMessage, setContactFormMessage] = React.useState<ContactFormMessage | null>(null)
  const [isContactSubmitting, setIsContactSubmitting] = React.useState(false)

  const ourDoctorsRef = React.useRef<HTMLElement | null>(null)
  const contactFormRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    setActiveHeroDoctorId('')
    setSelectedDoctorId('')
    setSelectedTreatmentId('')
    setActiveCuratedIndex(0)
    setVisibleFurtherTreatmentCount(furtherTreatmentPageSize)
    setContactFormFields(initialContactFormFields)
    setContactFormMessage(null)
    setIsContactSubmitting(false)
  }, [clinicSlug, furtherTreatmentPageSize, initialContactFormFields])

  React.useEffect(() => {
    const availableDoctorIds = doctors.map((doctor) => doctor.id)
    const nextSelectedDoctorId = sanitizeSelectedId(selectedDoctorId, availableDoctorIds)

    if (nextSelectedDoctorId !== selectedDoctorId) {
      setSelectedDoctorId(nextSelectedDoctorId)
    }
  }, [doctors, selectedDoctorId])

  React.useEffect(() => {
    const availableHeroDoctorIds = heroDoctors.map((doctor) => doctor.id)
    const nextActiveHeroDoctorId = sanitizeSelectedId(activeHeroDoctorId, availableHeroDoctorIds)

    if (nextActiveHeroDoctorId !== activeHeroDoctorId) {
      setActiveHeroDoctorId(nextActiveHeroDoctorId)
    }
  }, [activeHeroDoctorId, heroDoctors])

  React.useEffect(() => {
    const availableTreatmentIds = sortedTreatments.map((treatment) => treatment.id)
    const nextSelectedTreatmentId = sanitizeSelectedId(selectedTreatmentId, availableTreatmentIds)

    if (nextSelectedTreatmentId !== selectedTreatmentId) {
      setSelectedTreatmentId(nextSelectedTreatmentId)
    }
  }, [selectedTreatmentId, sortedTreatments])

  const selectedDoctor = doctors.find((doctor) => doctor.id === selectedDoctorId)
  const selectedTreatment = sortedTreatments.find((treatment) => treatment.id === selectedTreatmentId)
  const selectedDoctorIndex = doctors.findIndex((doctor) => doctor.id === selectedDoctorId)
  const relatedActiveIndex = selectedDoctorIndex >= 0 ? selectedDoctorIndex : undefined

  const scrollToContactForm = React.useCallback((options?: ContactFormScrollOptions) => {
    const contactFormSection = contactFormRef.current
    if (!contactFormSection) return

    contactFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' })

    if (options?.focus) {
      contactFormSection.focus({ preventScroll: true })
    }
  }, [])

  const scrollToOurDoctors = React.useCallback(() => {
    ourDoctorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const chooseTreatmentAndScroll = React.useCallback(
    (treatmentId: string) => {
      setSelectedTreatmentId(treatmentId)
      setContactFormMessage(null)
      scrollToContactForm()
    },
    [scrollToContactForm],
  )

  const showMoreFurtherTreatments = React.useCallback(() => {
    setVisibleFurtherTreatmentCount((count) => computeNextVisibleFurtherTreatmentCount(count, furtherTreatmentPageSize))
  }, [furtherTreatmentPageSize])

  const toggleDoctorSelection = React.useCallback(
    (doctorId: string) => {
      const result = resolveDoctorSelectionToggle(activeHeroDoctorId, doctorId)

      setActiveHeroDoctorId(result.nextActiveHeroDoctorId)
      setSelectedDoctorId(result.nextSelectedDoctorId)
      setContactFormMessage(null)

      if (result.shouldScrollToOurDoctors) {
        scrollToOurDoctors()
      }
    },
    [activeHeroDoctorId, scrollToOurDoctors],
  )

  const handleContactDoctor = React.useCallback(
    (doctorId?: string) => {
      if (doctorId) {
        setSelectedDoctorId(doctorId)
        setActiveHeroDoctorId(heroDoctors.some((doctor) => doctor.id === doctorId) ? doctorId : '')
      }

      setContactFormMessage(null)
      scrollToContactForm()
    },
    [heroDoctors, scrollToContactForm],
  )

  const handleContactFieldChange = React.useCallback(
    (field: keyof ContactFormFields, value: string) => {
      if (isContactSubmitting) return

      setContactFormFields((current) => ({
        ...current,
        [field]: value,
      }))
      setContactFormMessage(null)
    },
    [isContactSubmitting],
  )

  const handleContactSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (isContactSubmitting) return

      setIsContactSubmitting(true)
      setContactFormMessage(null)

      try {
        await submitClinicInquiry({
          clinicId,
          clinicSlug,
          fields: contactFormFields,
          selectedDoctorId,
          selectedDoctorName: selectedDoctor?.name,
          selectedTreatmentId,
          selectedTreatmentName: selectedTreatment?.name,
        })
        setContactFormMessage({
          text: 'Your contact request has been submitted successfully.',
          variant: 'success',
        })
      } catch {
        setContactFormMessage({
          text: 'Could not submit the contact request. Please try again.',
          variant: 'error',
        })
      } finally {
        setIsContactSubmitting(false)
      }
    },
    [
      clinicId,
      clinicSlug,
      contactFormFields,
      isContactSubmitting,
      selectedDoctor?.name,
      selectedDoctorId,
      selectedTreatment?.name,
      selectedTreatmentId,
    ],
  )

  const handleRelatedDoctorIndexChange = React.useCallback(
    (nextIndex: number) => {
      const doctor = doctors[nextIndex]
      if (!doctor) return

      setSelectedDoctorId(doctor.id)
      setActiveHeroDoctorId(heroDoctors.some((item) => item.id === doctor.id) ? doctor.id : '')
      setContactFormMessage(null)
    },
    [doctors, heroDoctors],
  )

  const handleDoctorSelectionChange = React.useCallback(
    (doctorId: string) => {
      if (isContactSubmitting) return

      setSelectedDoctorId(doctorId)
      setActiveHeroDoctorId(heroDoctors.some((doctor) => doctor.id === doctorId) ? doctorId : '')
      setContactFormMessage(null)
    },
    [heroDoctors, isContactSubmitting],
  )

  const handleTreatmentSelectionChange = React.useCallback(
    (treatmentId: string) => {
      if (isContactSubmitting) return

      setSelectedTreatmentId(treatmentId)
      setContactFormMessage(null)
    },
    [isContactSubmitting],
  )

  const handleResetContactFields = React.useCallback(() => {
    if (isContactSubmitting) return

    setContactFormFields(initialContactFormFields)
    setContactFormMessage(null)
  }, [initialContactFormFields, isContactSubmitting])

  const handleClearSelections = React.useCallback(() => {
    if (isContactSubmitting) return

    setActiveHeroDoctorId('')
    setSelectedDoctorId('')
    setSelectedTreatmentId('')
    setContactFormMessage(null)
  }, [isContactSubmitting])

  return {
    ourDoctorsRef,
    contactFormRef,
    activeHeroDoctorId,
    selectedDoctorId,
    selectedTreatmentId,
    activeCuratedIndex,
    visibleFurtherTreatmentCount,
    contactFormFields,
    contactFormMessage,
    isContactSubmitting,
    selectedDoctor,
    selectedTreatment,
    relatedActiveIndex,
    setActiveCuratedIndex,
    scrollToContactForm,
    chooseTreatmentAndScroll,
    showMoreFurtherTreatments,
    toggleDoctorSelection,
    handleContactDoctor,
    handleContactFieldChange,
    handleContactSubmit,
    handleRelatedDoctorIndexChange,
    handleDoctorSelectionChange,
    handleTreatmentSelectionChange,
    handleResetContactFields,
    handleClearSelections,
  }
}
