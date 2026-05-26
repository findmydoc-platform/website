import * as React from 'react'

import type { ContactFormFields, ContactFormSelectionError } from '@/components/organisms/ClinicDetail'
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
  treatmentTimeline?: string
  preferredContactWindow?: string
  message: string
  consent: boolean
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
  contactFormSelectionError: ContactFormSelectionError
  isSubmittingContact: boolean
  hasSubmittedContact: boolean
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

function getSelectionErrorFromSubmitMessage(message: string): ContactFormSelectionError {
  if (message === 'Doctor is not available for this clinic.') return 'doctor'
  if (message === 'Treatment is not available for this clinic.') return 'treatment'
  return null
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
  const [contactFormSelectionError, setContactFormSelectionError] = React.useState<ContactFormSelectionError>(null)
  const [isSubmittingContact, setIsSubmittingContact] = React.useState(false)
  const [hasSubmittedContact, setHasSubmittedContact] = React.useState(false)

  const ourDoctorsRef = React.useRef<HTMLElement | null>(null)
  const contactFormRef = React.useRef<HTMLElement | null>(null)
  const contactFormFeedbackRef = React.useRef<HTMLDivElement | null>(null)
  const contactSubmitLockedRef = React.useRef(false)

  React.useEffect(() => {
    setActiveHeroDoctorId('')
    setSelectedDoctorId('')
    setSelectedTreatmentId('')
    setActiveCuratedIndex(0)
    setVisibleFurtherTreatmentCount(furtherTreatmentPageSize)
    setContactFormFields(initialContactFormFields)
    setContactFormMessage(null)
    setContactFormMessageTone('success')
    setContactFormSelectionError(null)
    setIsSubmittingContact(false)
    setHasSubmittedContact(false)
    contactSubmitLockedRef.current = false
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

  const scrollToOurDoctors = React.useCallback(() => {
    ourDoctorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const chooseTreatmentAndScroll = React.useCallback(
    (treatmentId: string) => {
      setSelectedTreatmentId(treatmentId)
      setHasSubmittedContact(false)
      contactSubmitLockedRef.current = false
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(null)
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
      setHasSubmittedContact(false)
      contactSubmitLockedRef.current = false
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(null)

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

      setHasSubmittedContact(false)
      contactSubmitLockedRef.current = false
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(null)
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
      setHasSubmittedContact(false)
      contactSubmitLockedRef.current = false
      if (!contactFormSelectionError) {
        setContactFormMessage(null)
        setContactFormMessageTone('success')
      }
    },
    [contactFormSelectionError],
  )

  const handleContactSubmit = React.useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      if (contactSubmitLockedRef.current || isSubmittingContact || hasSubmittedContact) {
        return
      }

      if (!selectedDoctorId && !selectedTreatmentId) {
        setContactFormMessageTone('error')
        setContactFormSelectionError('selection')
        setContactFormMessage('Select a doctor or treatment.')
        return
      }

      setIsSubmittingContact(true)
      contactSubmitLockedRef.current = true
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(null)

      try {
        await submitClinicContactRequest({
          clinicId,
          doctorId: selectedDoctorId || undefined,
          treatmentId: selectedTreatmentId || undefined,
          fullName: contactFormFields.fullName,
          phoneNumber: contactFormFields.phoneNumber,
          email: contactFormFields.email,
          treatmentTimeline: contactFormFields.treatmentTimeline || undefined,
          preferredContactWindow: contactFormFields.preferredContactWindow || undefined,
          message: contactFormFields.note,
          consent: contactFormFields.consentAccepted,
        })

        setContactFormMessageTone('success')
        setContactFormMessage('Your clinic request has been sent successfully.')
        setHasSubmittedContact(true)
      } catch (error: unknown) {
        setContactFormMessageTone('error')
        setHasSubmittedContact(false)
        contactSubmitLockedRef.current = false
        const errorMessage = error instanceof Error ? error.message : 'Could not send your clinic request right now.'
        setContactFormSelectionError(getSelectionErrorFromSubmitMessage(errorMessage))
        setContactFormMessage(errorMessage)
      } finally {
        setIsSubmittingContact(false)
      }
    },
    [clinicId, contactFormFields, hasSubmittedContact, isSubmittingContact, selectedDoctorId, selectedTreatmentId],
  )

  const handleRelatedDoctorIndexChange = React.useCallback(
    (nextIndex: number) => {
      const doctor = doctors[nextIndex]
      if (!doctor) return

      setSelectedDoctorId(doctor.id)
      setActiveHeroDoctorId(heroDoctors.some((item) => item.id === doctor.id) ? doctor.id : '')
      setHasSubmittedContact(false)
      contactSubmitLockedRef.current = false
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(null)
    },
    [doctors, heroDoctors],
  )

  const handleDoctorSelectionChange = React.useCallback(
    (doctorId: string) => {
      setSelectedDoctorId(doctorId)
      setActiveHeroDoctorId(heroDoctors.some((doctor) => doctor.id === doctorId) ? doctorId : '')
      setHasSubmittedContact(false)
      contactSubmitLockedRef.current = false
      setContactFormMessage(null)
      setContactFormMessageTone('success')
      setContactFormSelectionError(null)
    },
    [heroDoctors],
  )

  const handleTreatmentSelectionChange = React.useCallback((treatmentId: string) => {
    setSelectedTreatmentId(treatmentId)
    setHasSubmittedContact(false)
    contactSubmitLockedRef.current = false
    setContactFormMessage(null)
    setContactFormMessageTone('success')
    setContactFormSelectionError(null)
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
    hasSubmittedContact,
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
  }
}
