'use client'

import * as React from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/atoms/button'
import type { ContactFormFields } from '@/components/organisms/ClinicDetail'
import { ClinicProfileInquiry } from './ClinicProfileInquiry'
import { ClinicProfileReviews } from '@/components/organisms/ClinicProfileReviews/ClinicProfileReviews'
import { useClinicDetailInteractionState } from '@/components/templates/ClinicDetailConcepts/hooks/useClinicDetailInteractionState'
import type { ClinicContactRequestSubmitter, ClinicDetailData } from '@/features/clinicDetail/contracts'
import type { PatientInquiryCreationContext } from '@/features/patientInquiries/creationContext'
import { ClinicProfileExperience } from './ClinicProfileExperience'
import type { ClinicProfileProps } from './ClinicProfile'

export type ClinicProfileCompleteProps = {
  data: ClinicDetailData
  inquiryCreation: PatientInquiryCreationContext
  onSubmitContactRequest: ClinicContactRequestSubmitter
  favorite: ClinicProfileProps['favorite']
  share: ClinicProfileProps['share']
  map: ClinicProfileProps['map']
  inquiryNotice?: React.ReactNode
}

export function ClinicProfileComplete({
  data,
  inquiryCreation,
  onSubmitContactRequest,
  favorite,
  share,
  map,
  inquiryNotice,
}: ClinicProfileCompleteProps) {
  const kind = inquiryCreation.kind
  const account = inquiryCreation.kind === 'authenticated' ? inquiryCreation.account : undefined
  const loginHref = inquiryCreation.kind === 'guest' ? undefined : inquiryCreation.loginHref
  const stableCreation = React.useMemo<PatientInquiryCreationContext>(() => {
    if (kind === 'guest') return { kind }
    if (kind === 'reauthentication-required') return { kind, loginHref: loginHref! }
    return {
      kind,
      loginHref: loginHref!,
      account: {
        firstName: account?.firstName || '',
        lastName: account?.lastName || '',
        email: account?.email || '',
        phoneNumber: account?.phoneNumber || '',
      },
    }
  }, [kind, loginHref, account?.firstName, account?.lastName, account?.email, account?.phoneNumber])
  const initialFields = React.useMemo<ContactFormFields>(
    () => ({
      firstName: stableCreation.kind === 'authenticated' ? stableCreation.account.firstName : '',
      lastName: stableCreation.kind === 'authenticated' ? stableCreation.account.lastName : '',
      email: stableCreation.kind === 'authenticated' ? stableCreation.account.email : '',
      phoneNumber: stableCreation.kind === 'authenticated' ? stableCreation.account.phoneNumber : '',
      treatmentTimeline: '',
      preferredContactWindow: '',
      note: '',
      consentAccepted: false,
      accountAuthorization: false,
    }),
    [stableCreation],
  )
  const state = useClinicDetailInteractionState({
    clinicId: data.clinicId,
    clinicSlug: data.clinicSlug,
    doctors: data.doctors,
    heroDoctors: data.doctors,
    sortedTreatments: data.treatments,
    initialContactFormFields: initialFields,
    inquiryCreation: stableCreation,
    furtherTreatmentPageSize: 6,
    onSubmitContactRequest,
  })
  const [showMobileAction, setShowMobileAction] = React.useState(true)
  React.useEffect(() => {
    const target = state.contactFormRef.current
    if (!target || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => setShowMobileAction(!entry?.isIntersecting), {
      threshold: 0,
    })
    observer.observe(target)
    return () => observer.disconnect()
  }, [state.contactFormRef, data.doctors.length, data.treatments.length])
  const available = data.doctors.length > 0 || data.treatments.length > 0
  const selectedDoctor = data.doctors.find((doctor) => doctor.id === state.selectedDoctorId)
  const selectedTreatment = data.treatments.find((treatment) => treatment.id === state.selectedTreatmentId)
  const reviewPanel = <ClinicProfileReviews ratingValue={data.trust.ratingValue} reviews={data.reviews} />
  return (
    <>
      <ClinicProfileExperience
        data={data}
        favorite={favorite}
        share={share}
        map={map}
        selectedDoctorId={state.selectedDoctorId || null}
        selectedTreatmentId={state.selectedTreatmentId || null}
        onDoctorChange={(id) => state.handleDoctorSelectionChange(id || '')}
        onTreatmentChange={(id) => state.handleTreatmentSelectionChange(id || '')}
        reviews={reviewPanel}
        overviewReviews={
          data.reviews.items.length ? (
            <section>
              <h2 className="text-2xl font-semibold">Patient reviews</h2>
              <p className="mt-3 text-muted-foreground">{data.reviews.totalCount} published reviews</p>
            </section>
          ) : null
        }
        inquiryAside={
          available
            ? ({ showDoctors, showTreatments }) => (
                <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
                  <p className="text-xs font-semibold tracking-widest text-primary uppercase">Your next step</p>
                  <h2 className="mt-3 text-2xl font-semibold">Your inquiry</h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    Ask the clinic about your options, costs or planning your visit.
                  </p>
                  <div className="mt-4 flex flex-col items-start gap-1">
                    {data.treatments.length ? (
                      <Button
                        type="button"
                        variant="link"
                        className="min-h-11 p-0 text-left whitespace-normal"
                        onClick={showTreatments}
                      >
                        {selectedTreatment?.name || 'Choose a treatment'}
                      </Button>
                    ) : null}
                    {data.doctors.length ? (
                      <Button
                        type="button"
                        variant="link"
                        className="min-h-11 p-0 text-left whitespace-normal"
                        onClick={showDoctors}
                      >
                        {selectedDoctor?.name || 'Choose a doctor'}
                      </Button>
                    ) : null}
                  </div>
                  <Button type="button" className="mt-4 min-h-11 w-full" onClick={state.scrollToContactForm}>
                    Make an inquiry <ArrowRight aria-hidden="true" />
                  </Button>
                  <p className="mt-3 text-xs text-muted-foreground">No commitment. Not a booking.</p>
                </div>
              )
            : undefined
        }
        afterLocation={
          available ? (
            <div className="mt-16 border-t pt-12 pb-24">
              {inquiryNotice}
              <ClinicProfileInquiry
                sectionId="clinic-inquiry"
                sectionRef={state.contactFormRef}
                fields={state.contactFormFields}
                inquiryCreation={stableCreation}
                isPhoneLocked={state.isPhoneLocked}
                requiresReauthentication={state.requiresReauthentication}
                submittedInquiryHref={state.submittedInquiryHref}
                preparationRegistrationHref={state.preparationRegistrationHref}
                selectedDoctorId={state.selectedDoctorId}
                selectedTreatmentId={state.selectedTreatmentId}
                doctors={data.doctors}
                treatments={data.treatments}
                message={state.contactFormMessage}
                messageTone={state.contactFormMessageTone}
                selectionError={state.contactFormSelectionError}
                isSubmitting={state.isSubmittingContact}
                isSubmitted={state.hasSubmittedContact}
                feedbackRef={state.contactFormFeedbackRef}
                onFieldChange={state.handleContactFieldChange}
                onDoctorChange={state.handleDoctorSelectionChange}
                onTreatmentChange={state.handleTreatmentSelectionChange}
                onSubmit={state.handleContactSubmit}
              />
            </div>
          ) : (
            <section className="mt-16 border-t pt-12">
              <h2 className="text-2xl font-semibold">Online inquiries</h2>
              <p className="mt-3 text-muted-foreground">
                Online inquiries through findmydoc are currently unavailable for this clinic.
              </p>
            </section>
          )
        }
      />
      {available && showMobileAction && !state.hasSubmittedContact ? (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-background p-4 shadow-lg lg:hidden">
          <span className="min-w-0 truncate text-sm font-semibold">
            {selectedTreatment?.name || selectedDoctor?.name || 'Your next step'}
          </span>
          <Button type="button" className="min-h-11 shrink-0" onClick={state.scrollToContactForm}>
            Make an inquiry <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </>
  )
}
