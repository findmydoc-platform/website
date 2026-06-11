'use client'

import * as React from 'react'
import { Activity, HeartPulse, Stethoscope, Syringe } from 'lucide-react'

import { Container } from '@/components/molecules/Container'
import {
  BeforeAfterCaseGallerySection,
  ClinicAppointmentSection,
  ClinicLocationSection,
  ClinicReviewsSection,
  FurtherTreatmentsSection,
  HeroOverviewSection,
  type ContactFormFields,
} from '@/components/organisms/ClinicDetail'
import { RelatedDoctorSection, type RelatedDoctorItem } from '@/components/organisms/Doctors'
import { TreatmentsStrip, type TreatmentsStripItem } from '@/components/organisms/TreatmentsStrip'
import { useCookieConsentToolAllowed } from '@/features/cookieConsent/useCookieConsentToolAllowed'
import { FavoriteClinicButton } from '@/features/favorites/FavoriteClinicButton'
import { postHogBrowserEvents, type ClinicCtaClickedProperties } from '@/posthog/client-api'
import { cn } from '@/utilities/ui'

import { useClinicDetailInteractionState } from './hooks/useClinicDetailInteractionState'
import { buildOpenStreetMapHref, formatUsd, sortTreatmentsByPrice } from './shared'
import type { ClinicDetailConceptProps } from './types'

const CURATED_TREATMENT_COUNT = 4
const FURTHER_TREATMENT_PAGE_SIZE = 6
const HERO_DOCTOR_PREVIEW_COUNT = 15
const CONTACT_FORM_ID = 'clinic-contact-form'
const CONTACT_SECTION_IMAGE = {
  src: '/images/clinic-detail/contact-fallback-home-image30.jpg',
  alt: 'Doctor preparing a clinic consultation',
}

const TREATMENT_ICONS = [Syringe, Stethoscope, HeartPulse, Activity] as const

const initialContactFormFields: ContactFormFields = {
  fullName: '',
  phoneNumber: '',
  email: '',
  treatmentTimeline: '',
  preferredContactWindow: '',
  note: '',
  consentAccepted: false,
}

function buildTreatmentDescription({ category, priceFromUsd }: { category?: string; priceFromUsd?: number }): string {
  const priceText = typeof priceFromUsd === 'number' ? `From ${formatUsd(priceFromUsd)}` : 'Price on request'
  const categoryText = category ? `${category}. ` : ''
  return `${categoryText}${priceText}.`
}

export function ClinicDetail({
  data,
  className,
  favorite,
  cookieConsentConfig = null,
  cookieConsentInitialConsent = null,
}: ClinicDetailConceptProps) {
  const heroDoctors = React.useMemo(() => data.doctors.slice(0, HERO_DOCTOR_PREVIEW_COUNT), [data.doctors])
  const sortedTreatments = React.useMemo(() => sortTreatmentsByPrice(data.treatments), [data.treatments])
  const curatedTreatments = React.useMemo(() => sortedTreatments.slice(0, CURATED_TREATMENT_COUNT), [sortedTreatments])
  const curatedTreatmentIds = React.useMemo(
    () => new Set(curatedTreatments.map((treatment) => treatment.id)),
    [curatedTreatments],
  )
  const furtherTreatments = React.useMemo(
    () => sortedTreatments.filter((treatment) => !curatedTreatmentIds.has(treatment.id)),
    [curatedTreatmentIds, sortedTreatments],
  )
  const openStreetMapHref = buildOpenStreetMapHref(data.location)
  const isOpenStreetMapAllowed = useCookieConsentToolAllowed(
    'openstreetmap',
    cookieConsentConfig,
    cookieConsentInitialConsent,
  )
  const appointmentImage = CONTACT_SECTION_IMAGE
  const clinicId = String(data.clinicId)
  const pagePath = React.useMemo(() => `/clinics/${encodeURIComponent(data.clinicSlug)}`, [data.clinicSlug])
  const trackedProfileViewKeyRef = React.useRef<string | null>(null)

  const interaction = useClinicDetailInteractionState({
    clinicId: data.clinicId,
    clinicSlug: data.clinicSlug,
    doctors: data.doctors,
    heroDoctors,
    sortedTreatments,
    initialContactFormFields,
    furtherTreatmentPageSize: FURTHER_TREATMENT_PAGE_SIZE,
  })
  const { chooseTreatmentAndScroll, handleContactDoctor, scrollToContactForm } = interaction

  React.useEffect(() => {
    const trackingKey = `${clinicId}:${data.clinicSlug}`
    if (trackedProfileViewKeyRef.current === trackingKey) return

    trackedProfileViewKeyRef.current = trackingKey
    postHogBrowserEvents.clinicProfileViewed({
      clinic_id: clinicId,
      clinic_slug: data.clinicSlug,
      has_doctors: data.doctors.length > 0,
      has_treatments: data.treatments.length > 0,
      page_path: pagePath,
      source_route: 'clinic_detail',
      verification_tier: data.trust.verification,
    })
  }, [clinicId, data.clinicSlug, data.doctors.length, data.treatments.length, data.trust.verification, pagePath])

  const captureClinicCtaClick = React.useCallback(
    (
      properties: Pick<
        ClinicCtaClickedProperties,
        'cta_id' | 'cta_label' | 'cta_location' | 'doctor_id' | 'treatment_id'
      >,
    ) => {
      postHogBrowserEvents.clinicCtaClicked({
        clinic_id: clinicId,
        clinic_slug: data.clinicSlug,
        page_path: pagePath,
        source_route: 'clinic_detail',
        ...properties,
      })
    },
    [clinicId, data.clinicSlug, pagePath],
  )

  const handleCuratedTreatmentClick = React.useCallback(
    (treatmentId: string) => {
      captureClinicCtaClick({
        cta_id: 'choose_treatment',
        cta_label: 'Choose Treatment',
        cta_location: 'treatment_strip',
        treatment_id: treatmentId,
      })
      chooseTreatmentAndScroll(treatmentId)
    },
    [captureClinicCtaClick, chooseTreatmentAndScroll],
  )

  const handleFurtherTreatmentClick = React.useCallback(
    (treatmentId: string) => {
      captureClinicCtaClick({
        cta_id: 'choose_treatment',
        cta_label: 'Choose Treatment',
        cta_location: 'further_treatments',
        treatment_id: treatmentId,
      })
      chooseTreatmentAndScroll(treatmentId)
    },
    [captureClinicCtaClick, chooseTreatmentAndScroll],
  )

  const handleLocationContactClick = React.useCallback(
    (origin: 'location_card' | 'map_overlay') => {
      captureClinicCtaClick({
        cta_id: 'contact',
        cta_label: 'Contact',
        cta_location: origin,
      })
      scrollToContactForm()
    },
    [captureClinicCtaClick, scrollToContactForm],
  )

  const curatedTreatmentItems = React.useMemo<TreatmentsStripItem[]>(
    () =>
      curatedTreatments.map((treatment, index) => {
        const Icon = TREATMENT_ICONS[index % TREATMENT_ICONS.length] ?? Activity
        return {
          title: treatment.name,
          description: buildTreatmentDescription({
            category: treatment.category,
            priceFromUsd: treatment.priceFromUsd,
          }),
          icon: <Icon className="size-7" aria-hidden={true} />,
          cta: {
            label: 'Choose Treatment',
            onClick: () => handleCuratedTreatmentClick(treatment.id),
          },
        }
      }),
    [curatedTreatments, handleCuratedTreatmentClick],
  )

  const relatedDoctors = React.useMemo<RelatedDoctorItem[]>(() => {
    return data.doctors.map((doctor) => ({
      id: doctor.id,
      heroMedia: {
        src: doctor.image.src,
        alt: doctor.image.alt,
      },
      card: {
        name: doctor.name,
        subtitle: doctor.specialty,
        description: doctor.description,
        qualifications: doctor.qualifications,
        experienceYears: doctor.yearsExperience,
        languages: doctor.languages,
        rating:
          typeof doctor.ratingValue === 'number' && typeof doctor.reviewCount === 'number' && doctor.reviewCount > 0
            ? {
                value: doctor.ratingValue,
                reviewCount: doctor.reviewCount,
              }
            : undefined,
        socialLinks: doctor.socialLinks,
        actions: {
          booking: {
            href: `#${CONTACT_FORM_ID}`,
            label: 'Contact Doctor',
            onClick: () => {
              captureClinicCtaClick({
                cta_id: 'contact_doctor',
                cta_label: 'Contact Doctor',
                cta_location: 'doctor_card',
                doctor_id: doctor.id,
              })
              handleContactDoctor(doctor.id)
            },
          },
        },
      },
    }))
  }, [captureClinicCtaClick, data.doctors, handleContactDoctor])

  return (
    <main className={cn('overflow-x-clip bg-site-canvas text-foreground', className)}>
      <Container className="pt-10 pb-14 lg:pt-20 lg:pb-24 xl:pb-48">
        {/* Figma parity requires fixed card/image dimensions for the hero composition and overlap behavior. */}
        <HeroOverviewSection
          clinicName={data.clinicName}
          description={data.description}
          heroImage={data.heroImage}
          trust={data.trust}
          doctors={heroDoctors}
          activeDoctorId={interaction.activeHeroDoctorId}
          onDoctorSelect={interaction.toggleDoctorSelection}
          favoriteAction={
            favorite ? (
              <FavoriteClinicButton
                clinicId={data.clinicId}
                initialFavoriteId={favorite.favoriteId ?? null}
                isPatient={favorite.isPatient}
                loginHref={favorite.loginHref}
                variant="hero"
                unsavedLabel="Save clinic"
              />
            ) : undefined
          }
        />
      </Container>

      <Container className="pb-10 lg:pb-14">
        <ClinicReviewsSection ratingValue={data.trust.ratingValue} reviews={data.reviews} />
      </Container>

      {data.location.fullAddress || (isOpenStreetMapAllowed && openStreetMapHref) ? (
        <Container className="pb-10">
          <ClinicLocationSection
            clinicName={data.clinicName}
            location={data.location}
            mapHref={openStreetMapHref}
            isOpenStreetMapAllowed={isOpenStreetMapAllowed}
            onContactClick={handleLocationContactClick}
          />
        </Container>
      ) : null}

      {curatedTreatments.length ? (
        <TreatmentsStrip
          eyebrow="CURATED"
          heading="Treatments"
          items={curatedTreatmentItems}
          activeIndex={Math.min(interaction.activeCuratedIndex, Math.max(0, curatedTreatmentItems.length - 1))}
          onActiveIndexChange={interaction.setActiveCuratedIndex}
        />
      ) : null}

      <Container className="pb-12">
        <FurtherTreatmentsSection
          treatments={furtherTreatments}
          visibleCount={interaction.visibleFurtherTreatmentCount}
          onShowMore={interaction.showMoreFurtherTreatments}
          onChooseTreatment={handleFurtherTreatmentClick}
        />
      </Container>

      {data.beforeAfterEntries.length > 0 ? (
        <Container className="pb-10">
          <BeforeAfterCaseGallerySection entries={data.beforeAfterEntries} variant="spotlightQueueReveal" />
        </Container>
      ) : null}

      {relatedDoctors.length ? (
        <section ref={interaction.ourDoctorsRef}>
          <Container className="py-8 lg:py-14">
            <RelatedDoctorSection
              title="Our Doctors"
              doctors={relatedDoctors}
              initialIndex={0}
              activeIndex={interaction.relatedActiveIndex}
              onActiveIndexChange={interaction.handleRelatedDoctorIndexChange}
              className="[&_div.container-content]:px-0"
            />
          </Container>
        </section>
      ) : null}

      <Container className="pt-2 pb-10 lg:pt-8 lg:pb-16">
        <ClinicAppointmentSection
          sectionId={CONTACT_FORM_ID}
          sectionRef={interaction.contactFormRef}
          feedbackRef={interaction.contactFormFeedbackRef}
          fields={interaction.contactFormFields}
          selectedDoctorId={interaction.selectedDoctorId}
          selectedTreatmentId={interaction.selectedTreatmentId}
          doctors={data.doctors}
          treatments={sortedTreatments}
          appointmentImage={appointmentImage}
          message={interaction.contactFormMessage}
          messageTone={interaction.contactFormMessageTone}
          selectionError={interaction.contactFormSelectionError}
          isSubmitting={interaction.isSubmittingContact}
          isSubmitted={interaction.hasSubmittedContact}
          onFieldChange={interaction.handleContactFieldChange}
          onDoctorChange={interaction.handleDoctorSelectionChange}
          onTreatmentChange={interaction.handleTreatmentSelectionChange}
          onSubmit={interaction.handleContactSubmit}
        />
      </Container>
    </main>
  )
}
