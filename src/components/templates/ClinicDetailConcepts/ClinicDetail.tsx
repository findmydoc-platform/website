'use client'

import * as React from 'react'
import { Activity, HeartPulse, Stethoscope, Syringe } from 'lucide-react'

import { Container } from '@/components/molecules/Container'
import {
  BeforeAfterCaseGallerySection,
  ClinicAppointmentSection,
  ClinicLocationSection,
  FurtherTreatmentsSection,
  HeroOverviewSection,
  type ContactFormFields,
} from '@/components/organisms/ClinicDetail'
import { RelatedDoctorSection, type RelatedDoctorItem } from '@/components/organisms/Doctors'
import { TreatmentsStrip, type TreatmentsStripItem } from '@/components/organisms/TreatmentsStrip'
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
  preferredDate: '',
  preferredTime: '',
  note: '',
}

function buildTreatmentDescription({ category, priceFromUsd }: { category?: string; priceFromUsd?: number }): string {
  const priceText = typeof priceFromUsd === 'number' ? `From ${formatUsd(priceFromUsd)}` : 'Price on request'
  const categoryText = category ? `${category}. ` : ''
  return `${categoryText}${priceText}.`
}

export function ClinicDetail({ data, className }: ClinicDetailConceptProps) {
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
  const appointmentImage = CONTACT_SECTION_IMAGE

  const interaction = useClinicDetailInteractionState({
    clinicSlug: data.clinicSlug,
    doctors: data.doctors,
    heroDoctors,
    sortedTreatments,
    initialContactFormFields,
    furtherTreatmentPageSize: FURTHER_TREATMENT_PAGE_SIZE,
  })
  const { chooseTreatmentAndScroll, handleContactDoctor } = interaction

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
            onClick: () => chooseTreatmentAndScroll(treatment.id),
          },
        }
      }),
    [chooseTreatmentAndScroll, curatedTreatments],
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
            onClick: () => handleContactDoctor(doctor.id),
          },
        },
      },
    }))
  }, [data.doctors, handleContactDoctor])

  return (
    <main className={cn('bg-muted text-foreground', className)}>
      <Container className="pt-16 pb-28 lg:pt-20 lg:pb-64">
        {/* Figma parity requires fixed card/image dimensions for the hero composition and overlap behavior. */}
        <HeroOverviewSection
          clinicName={data.clinicName}
          description={data.description}
          heroImage={data.heroImage}
          trust={data.trust}
          doctors={heroDoctors}
          activeDoctorId={interaction.activeHeroDoctorId}
          onDoctorSelect={interaction.toggleDoctorSelection}
        />
      </Container>

      {openStreetMapHref || data.location.fullAddress ? (
        <Container className="pb-10">
          <ClinicLocationSection
            clinicName={data.clinicName}
            location={data.location}
            mapHref={openStreetMapHref}
            onContactClick={interaction.scrollToContactForm}
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
          onChooseTreatment={interaction.chooseTreatmentAndScroll}
        />
      </Container>

      {data.beforeAfterEntries.length > 0 ? (
        <Container className="pb-10">
          <BeforeAfterCaseGallerySection entries={data.beforeAfterEntries} variant="spotlightQueueReveal" />
        </Container>
      ) : null}

      {relatedDoctors.length ? (
        <section ref={interaction.ourDoctorsRef}>
          <Container className="py-10 lg:py-14">
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

      <Container className="pt-4 pb-12 lg:pt-8 lg:pb-16">
        <ClinicAppointmentSection
          sectionId={CONTACT_FORM_ID}
          sectionRef={interaction.contactFormRef}
          fields={interaction.contactFormFields}
          selectedDoctorId={interaction.selectedDoctorId}
          selectedTreatmentId={interaction.selectedTreatmentId}
          selectedDoctorName={interaction.selectedDoctor?.name}
          selectedTreatmentName={interaction.selectedTreatment?.name}
          doctors={data.doctors}
          treatments={sortedTreatments}
          appointmentImage={appointmentImage}
          message={interaction.contactFormMessage}
          onFieldChange={interaction.handleContactFieldChange}
          onDoctorChange={interaction.handleDoctorSelectionChange}
          onTreatmentChange={interaction.handleTreatmentSelectionChange}
          onSubmit={interaction.handleContactSubmit}
          onResetFields={interaction.handleResetContactFields}
          onClearSelections={interaction.handleClearSelections}
        />
      </Container>
    </main>
  )
}
