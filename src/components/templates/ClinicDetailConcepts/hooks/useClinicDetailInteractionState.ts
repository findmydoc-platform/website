import * as React from 'react'

import type { ContactFormFields } from '@/components/organisms/ClinicDetail'
import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'
import {
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

type ContactFormMessageTone = 'success' | 'error'

type ClinicContactRequestPayload = {
  clinicId: number
  doctorId?: string
  treatmentId?: string
  fullName: string
  phoneNumber: string
  email: string
  preferredDate?: string
  preferredTime?: string
  message: string
  consent: boolean
  formUrl?: string
}

type UseClinicDetailInteractionStateResult = {
  ourDoctorsRef: React.RefObject<HTMLElement | null>
  contactFormRef: React.RefObject<HTMLElement | null>
  contactFormFeedbackRef: React.RefObject<HTMLDivElement | null>
  activeHeroDoctorId: string
  selectedDoctorId: string
  selectedTreatmentId: string
  activeCuratedIndex: number
  visibleFurtherTreatmentCount: number
  contactFormFields: ContactFormFields
  contactFormMessage: string | null
  contactFormMessageTone: ContactFormMessageTone
  contactFormSelectionError: boolean
  isSubmittingContact: boolean
  selectedDoctor: ClinicDetailDoctor | undefined
  selectedTreatment: ClinicDetailTreatment | undefined
  relatedActiveIndex: number | undefined
  setActiveCuratedIndex: React.Dispatch<React.SetStateAction<number>>
  scrollToContactForm: () => void
  chooseTreatmentAndScroll: (treatmentId: string) => void
  showMoreFurtherTreatments: () => void
  toggleDoctorSelection: (doctorId: string) => void
  handleContactDoctor: (doctorId?: string) => void
  handleContactFieldChange: <K extends keyof ContactFormFields>(field: K, value: ContactFormFields[K]) => void
  handleContactSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  handleRelatedDoctorIndexChange: (nextIndex: number) => void
  handleDoctorSelectionChange: (doctorId: string) => void
  handleTreatmentSelectionChange: (treatmentId: string) => void
  handleResetContactFields: () => void
  handleClearSelections: () => void
}

async function submitClinicContactRequest(payload: ClinicContactRequestPayload): Promise<void> {
  const response = await fetch('/api/clinic-contact-requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const errorPayload = await response.json().catch(() => ({}))
    const errorMessage =
      typeof (errorPayload as { error?: unknown }).error === 'string'
        ? (errorPayload as { error: string }).error
        : 'Could not send your clinic request right now.'
    throw new Error(errorMessage)
  }
}

function getCurrentFormUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined
  return window.location.href
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
  const [contactFormMessage, setContactFormMessage] = React.useState<string | null>(null)
  const [contactFormMessageTone, setContactFormMessageTone] = React.useState<ContactFormMessageTone>('success')
  const [contactFormSelectionError, setContactFormSelectionError] = React.useState(false)
  const [isSubmittingContact, setIsSubmittingContact] = React.useState(false)

  const ourDoctorsRef = React.useRef<HTMLElement | null>(null)
  const contactFormRef = React.useRef<HTMLElement | null>(null)
  const contactFormFeedbackRef = React.useRef<HTMLDivElement | null>(null)

  React.useEffect(() => {
    setActiveHeroDoctorId('')
    setSelectedDoctorId('')
    setSelectedTreatmentId('')
    setActiveCuratedIndex(0)
    setVisibleFurtherTreatmentCount(furtherTreatmentPageSize)
    setContactFormFields(initialContactFormFields)
    setContactFormMessage(null)
    setContactFormMessageTone('success')
    setContactFormSelectionError(false)
    setIsSubmittingContact(false)
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

  const scrollToContactForm = React.useCallback(() => {
    const contactForm = contactFormRef.current
    if (!contactForm) return

    contactForm.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.setTimeout(() => {
      contactForm.focus({ preventScroll: true })
    }, 250)
  }, [])

  React.useEffect(() => {
    if (!contactFormMessage) return

    window.requestAnimationFrame(() => {
      const feedback = contactFormFeedbackRef.current
      if (!feedback) return

      feedback.scrollIntoView({ behavior: 'smooth', block: 'center' })
      feedback.focus({ preventScroll: true })
    })
  }, [contactFormMessage])

  const scrollToOurDoctors = React.useCallback(() => {
    ourDoctorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const chooseTreatmentAndScroll = React.useCallback(
    (treatmentId: string) => {
      setSelectedTreatmentId(treatmentId)
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(false)
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
      setContactFormMessageTone('success')
      setContactFormSelectionError(false)

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
      setContactFormMessageTone('success')
      setContactFormSelectionError(false)
      scrollToContactForm()
    },
    [heroDoctors, scrollToContactForm],
  )

  const handleContactFieldChange = React.useCallback(
    <K extends keyof ContactFormFields>(field: K, value: ContactFormFields[K]) => {
      setContactFormFields(
        (current) =>
          ({
            ...current,
            [field]: value,
          }) as ContactFormFields,
      )
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(false)
    },
    [],
  )

  const handleContactSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (!selectedDoctorId && !selectedTreatmentId) {
        setContactFormMessageTone('error')
        setContactFormSelectionError(true)
        setContactFormMessage('Select a doctor or treatment.')
        return
      }

      setIsSubmittingContact(true)
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(false)

      try {
        await submitClinicContactRequest({
          clinicId,
          doctorId: selectedDoctorId || undefined,
          treatmentId: selectedTreatmentId || undefined,
          fullName: contactFormFields.fullName,
          phoneNumber: contactFormFields.phoneNumber,
          email: contactFormFields.email,
          preferredDate: contactFormFields.preferredDate || undefined,
          preferredTime: contactFormFields.preferredTime || undefined,
          message: contactFormFields.note,
          consent: contactFormFields.consentAccepted,
          formUrl: getCurrentFormUrl(),
        })

        setContactFormMessageTone('success')
        setContactFormMessage('Your clinic request has been sent successfully.')
      } catch (error: unknown) {
        setContactFormMessageTone('error')
        setContactFormMessage(error instanceof Error ? error.message : 'Could not send your clinic request right now.')
      } finally {
        setIsSubmittingContact(false)
      }
    },
    [clinicId, contactFormFields, selectedDoctorId, selectedTreatmentId],
  )

  const handleRelatedDoctorIndexChange = React.useCallback(
    (nextIndex: number) => {
      const doctor = doctors[nextIndex]
      if (!doctor) return

      setSelectedDoctorId(doctor.id)
      setActiveHeroDoctorId(heroDoctors.some((item) => item.id === doctor.id) ? doctor.id : '')
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(false)
    },
    [doctors, heroDoctors],
  )

  const handleDoctorSelectionChange = React.useCallback(
    (doctorId: string) => {
      setSelectedDoctorId(doctorId)
      setActiveHeroDoctorId(heroDoctors.some((doctor) => doctor.id === doctorId) ? doctorId : '')
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(false)
    },
    [heroDoctors],
  )

  const handleTreatmentSelectionChange = React.useCallback((treatmentId: string) => {
    setSelectedTreatmentId(treatmentId)
    setContactFormMessage(null)
    setContactFormMessageTone('success')
    setContactFormSelectionError(false)
  }, [])

  const handleResetContactFields = React.useCallback(() => {
    setContactFormFields(initialContactFormFields)
    setContactFormMessage(null)
    setContactFormMessageTone('success')
    setContactFormSelectionError(false)
  }, [initialContactFormFields])

  const handleClearSelections = React.useCallback(() => {
    setActiveHeroDoctorId('')
    setSelectedDoctorId('')
    setSelectedTreatmentId('')
    setContactFormMessage(null)
    setContactFormMessageTone('success')
    setContactFormSelectionError(false)
  }, [])

  return {
    ourDoctorsRef,
    contactFormRef,
    contactFormFeedbackRef,
    activeHeroDoctorId,
    selectedDoctorId,
    selectedTreatmentId,
    activeCuratedIndex,
    visibleFurtherTreatmentCount,
    contactFormFields,
    contactFormMessage,
    contactFormMessageTone,
    contactFormSelectionError,
    isSubmittingContact,
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
