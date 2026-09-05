import * as React from 'react'

import type { ContactFormFields, ContactFormSelectionError } from '@/components/organisms/ClinicDetail'
import {
  ClinicContactRequestError,
  type ClinicContactRequestSubmitter,
  type ClinicDetailDoctor,
  type ClinicDetailTreatment,
} from '@/features/clinicDetail/contracts'
import type { PatientInquiryCreationContext } from '@/features/patientInquiries/creationContext'
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
  inquiryCreation: PatientInquiryCreationContext
  furtherTreatmentPageSize: number
  onSubmitContactRequest: ClinicContactRequestSubmitter
}

type ContactFormMessageTone = 'success' | 'error'
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
  isPhoneLocked: boolean
  requiresReauthentication: boolean
  submittedInquiryHref: string | null
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

function createContactRequestKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `contact-${Date.now()}-${Math.random().toString(36).slice(2)}`
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
  inquiryCreation,
  furtherTreatmentPageSize,
  onSubmitContactRequest,
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
  const [isPhoneLocked, setIsPhoneLocked] = React.useState(
    inquiryCreation.kind === 'authenticated' && Boolean(inquiryCreation.account.phoneNumber),
  )
  const [requiresReauthentication, setRequiresReauthentication] = React.useState(
    inquiryCreation.kind === 'reauthentication-required',
  )
  const [submittedInquiryHref, setSubmittedInquiryHref] = React.useState<string | null>(null)

  const ourDoctorsRef = React.useRef<HTMLElement | null>(null)
  const contactFormRef = React.useRef<HTMLElement | null>(null)
  const contactFormFeedbackRef = React.useRef<HTMLDivElement | null>(null)
  const contactSubmitLockedRef = React.useRef(false)
  const contactIdempotencyKeyRef = React.useRef<string | null>(null)

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
    setIsPhoneLocked(inquiryCreation.kind === 'authenticated' && Boolean(inquiryCreation.account.phoneNumber))
    setRequiresReauthentication(inquiryCreation.kind === 'reauthentication-required')
    setSubmittedInquiryHref(null)
    contactSubmitLockedRef.current = false
    contactIdempotencyKeyRef.current = null
  }, [clinicSlug, furtherTreatmentPageSize, initialContactFormFields, inquiryCreation])

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
      contactIdempotencyKeyRef.current = null
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
      contactIdempotencyKeyRef.current = null

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
      contactIdempotencyKeyRef.current = null
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
      contactIdempotencyKeyRef.current = null
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

      if (requiresReauthentication || inquiryCreation.kind === 'reauthentication-required') {
        setContactFormMessageTone('error')
        setContactFormMessage('Your session has ended. Sign in again before sending this request.')
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
        const idempotencyKey = contactIdempotencyKeyRef.current ?? createContactRequestKey()
        contactIdempotencyKeyRef.current = idempotencyKey
        const authenticated = inquiryCreation.kind === 'authenticated'
        const result = await onSubmitContactRequest(
          {
            clinicId: String(clinicId),
            doctorId: selectedDoctorId || undefined,
            treatmentId: selectedTreatmentId || undefined,
            ...(authenticated
              ? inquiryCreation.account.phoneNumber
                ? {}
                : { phoneNumber: contactFormFields.phoneNumber }
              : {
                  email: contactFormFields.email,
                  fullName: `${contactFormFields.firstName} ${contactFormFields.lastName}`.trim(),
                  phoneNumber: contactFormFields.phoneNumber,
                }),
            idempotencyKey,
            treatmentTimeline: contactFormFields.treatmentTimeline || undefined,
            preferredContactWindow: contactFormFields.preferredContactWindow || undefined,
            message: contactFormFields.note,
            consent: contactFormFields.consentAccepted,
          },
          authenticated,
        )

        setContactFormMessageTone('success')
        setContactFormMessage('Your clinic request has been sent successfully.')
        setHasSubmittedContact(true)
        setIsPhoneLocked(authenticated)
        setSubmittedInquiryHref(authenticated ? `/patient/inquiries/${encodeURIComponent(result.id)}` : null)
      } catch (error: unknown) {
        setContactFormMessageTone('error')
        setHasSubmittedContact(false)
        contactSubmitLockedRef.current = false
        const errorMessage = error instanceof Error ? error.message : 'Could not send your clinic request right now.'
        if (error instanceof ClinicContactRequestError && error.requiresReauthentication) {
          setRequiresReauthentication(true)
        }
        setContactFormSelectionError(getSelectionErrorFromSubmitMessage(errorMessage))
        setContactFormMessage(errorMessage)
      } finally {
        setIsSubmittingContact(false)
      }
    },
    [
      clinicId,
      contactFormFields,
      hasSubmittedContact,
      inquiryCreation,
      isSubmittingContact,
      onSubmitContactRequest,
      requiresReauthentication,
      selectedDoctorId,
      selectedTreatmentId,
    ],
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
      contactIdempotencyKeyRef.current = null
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
      contactIdempotencyKeyRef.current = null
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
    contactIdempotencyKeyRef.current = null
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
    isPhoneLocked,
    requiresReauthentication,
    submittedInquiryHref,
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
