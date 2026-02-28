import * as React from 'react'

import type { ContactFormFields } from '@/components/organisms/ClinicDetail'
import type { ClinicDetailDoctor, ClinicDetailTreatment } from '@/components/templates/ClinicDetailConcepts/types'
import {
  buildContactRequestMessage,
  computeNextVisibleFurtherTreatmentCount,
  resolveDoctorSelectionToggle,
  sanitizeSelectedId,
} from '@/components/templates/ClinicDetailConcepts/hooks/clinicDetailInteraction.logic'

type UseClinicDetailInteractionStateArgs = {
  clinicSlug: string
  doctors: ClinicDetailDoctor[]
  heroDoctors: ClinicDetailDoctor[]
  sortedTreatments: ClinicDetailTreatment[]
  initialContactFormFields: ContactFormFields
  furtherTreatmentPageSize: number
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
  contactFormMessage: string | null
  selectedDoctor: ClinicDetailDoctor | undefined
  selectedTreatment: ClinicDetailTreatment | undefined
  relatedActiveIndex: number | undefined
  setActiveCuratedIndex: React.Dispatch<React.SetStateAction<number>>
  scrollToContactForm: () => void
  chooseTreatmentAndScroll: (treatmentId: string) => void
  showMoreFurtherTreatments: () => void
  toggleDoctorSelection: (doctorId: string) => void
  handleContactDoctor: (doctorId?: string) => void
  handleContactFieldChange: (field: keyof ContactFormFields, value: string) => void
  handleContactSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  handleRelatedDoctorIndexChange: (nextIndex: number) => void
  handleDoctorSelectionChange: (doctorId: string) => void
  handleTreatmentSelectionChange: (treatmentId: string) => void
  handleResetContactFields: () => void
  handleClearSelections: () => void
}

export function useClinicDetailInteractionState({
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
    contactFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  const handleContactFieldChange = React.useCallback((field: keyof ContactFormFields, value: string) => {
    setContactFormFields((current) => ({
      ...current,
      [field]: value,
    }))
    setContactFormMessage(null)
  }, [])

  const handleContactSubmit = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      setContactFormMessage(
        buildContactRequestMessage({
          doctorName: selectedDoctor?.name,
          treatmentName: selectedTreatment?.name,
        }),
      )
    },
    [selectedDoctor?.name, selectedTreatment?.name],
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
      setSelectedDoctorId(doctorId)
      setActiveHeroDoctorId(heroDoctors.some((doctor) => doctor.id === doctorId) ? doctorId : '')
      setContactFormMessage(null)
    },
    [heroDoctors],
  )

  const handleTreatmentSelectionChange = React.useCallback((treatmentId: string) => {
    setSelectedTreatmentId(treatmentId)
    setContactFormMessage(null)
  }, [])

  const handleResetContactFields = React.useCallback(() => {
    setContactFormFields(initialContactFormFields)
    setContactFormMessage(null)
  }, [initialContactFormFields])

  const handleClearSelections = React.useCallback(() => {
    setActiveHeroDoctorId('')
    setSelectedDoctorId('')
    setSelectedTreatmentId('')
    setContactFormMessage(null)
  }, [])

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
