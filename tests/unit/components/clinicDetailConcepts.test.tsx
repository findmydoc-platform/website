// @vitest-environment jsdom
import React from 'react'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  beforeAfterCaseGallerySection: vi.fn(() => null),
  clinicAppointmentSection: vi.fn(() => null),
  clinicLocationSection: vi.fn(() => null),
  clinicReviewsSection: vi.fn(() => null),
  disclaimerNoticeComponent: vi.fn(() => null),
  favoriteClinicButton: vi.fn(() => null),
  furtherTreatmentsSection: vi.fn(() => null),
  heroOverviewSection: vi.fn(() => null),
  relatedDoctorSection: vi.fn(() => null),
  treatmentsStrip: vi.fn(() => null),
  getCookieConsentToolAllowedMock: vi.fn(() => false),
  interactionStateMock: vi.fn(() => ({
    activeHeroDoctorId: null,
    toggleDoctorSelection: vi.fn(),
    activeCuratedIndex: 0,
    setActiveCuratedIndex: vi.fn(),
    visibleFurtherTreatmentCount: 0,
    showMoreFurtherTreatments: vi.fn(),
    relatedActiveIndex: 0,
    handleRelatedDoctorIndexChange: vi.fn(),
    ourDoctorsRef: { current: null },
    contactFormRef: { current: null },
    contactFormFeedbackRef: { current: null },
    contactFormFields: {
      fullName: '',
      phoneNumber: '',
      email: '',
      treatmentTimeline: '',
      preferredContactWindow: '',
      note: '',
      consentAccepted: false,
    },
    selectedDoctorId: null,
    selectedTreatmentId: null,
    contactFormMessage: null,
    contactFormMessageTone: 'neutral',
    contactFormSelectionError: null,
    isSubmittingContact: false,
    hasSubmittedContact: false,
    handleContactFieldChange: vi.fn(),
    handleDoctorSelectionChange: vi.fn(),
    handleTreatmentSelectionChange: vi.fn(),
    handleContactSubmit: vi.fn(),
    chooseTreatmentAndScroll: vi.fn(),
    handleContactDoctor: vi.fn(),
    scrollToContactForm: vi.fn(),
  })),
  postHogBrowserEvents: {
    clinicProfileViewed: vi.fn(),
    clinicCtaClicked: vi.fn(),
  },
}))

vi.mock('@/components/molecules/DisclaimerNotice', () => ({
  DisclaimerNotice: mocks.disclaimerNoticeComponent,
}))

vi.mock('@/components/organisms/ClinicDetail', () => ({
  BeforeAfterCaseGallerySection: mocks.beforeAfterCaseGallerySection,
  ClinicAppointmentSection: mocks.clinicAppointmentSection,
  ClinicLocationSection: mocks.clinicLocationSection,
  ClinicReviewsSection: mocks.clinicReviewsSection,
  FurtherTreatmentsSection: mocks.furtherTreatmentsSection,
  HeroOverviewSection: mocks.heroOverviewSection,
}))

vi.mock('@/components/organisms/Doctors', () => ({
  RelatedDoctorSection: mocks.relatedDoctorSection,
}))

vi.mock('@/components/organisms/TreatmentsStrip', () => ({
  TreatmentsStrip: mocks.treatmentsStrip,
}))

vi.mock('@/features/cookieConsent/useCookieConsentToolAllowed', () => ({
  useCookieConsentToolAllowed: mocks.getCookieConsentToolAllowedMock,
}))

vi.mock('@/features/favorites/FavoriteClinicButton', () => ({
  FavoriteClinicButton: mocks.favoriteClinicButton,
}))

vi.mock('@/posthog/client-api', () => ({
  postHogBrowserEvents: mocks.postHogBrowserEvents,
}))

vi.mock('@/components/templates/ClinicDetailConcepts/hooks/useClinicDetailInteractionState', () => ({
  useClinicDetailInteractionState: mocks.interactionStateMock,
}))

vi.mock('@/components/templates/ClinicDetailConcepts/shared', () => ({
  buildOpenStreetMapHref: vi.fn(() => null),
  formatUsd: vi.fn((value: number) => `$${value}`),
  sortTreatmentsByPrice: vi.fn((treatments: Array<{ id: string }>) => treatments),
}))

import { ClinicDetail } from '@/components/templates/ClinicDetailConcepts/ClinicDetail'
import { DISCLAIMER_COPY } from '@/utilities/legal/disclaimers'

const baseData = {
  clinicId: 1,
  clinicSlug: 'template-test',
  clinicName: 'Template Test Clinic',
  breadcrumbs: [
    { label: 'Home', href: '/' },
    { label: 'Clinics', href: '/listing-comparison' },
    { label: 'Template Test Clinic', href: '/clinics/template-test' },
  ],
  heroImage: { src: '/hero.jpg', alt: 'Hero' },
  description: 'Clinic description',
  trust: {
    ratingValue: 4.8,
    reviewCount: 12,
    verification: 'gold' as const,
    accreditations: [],
    languages: [],
  },
  reviews: {
    totalCount: 0,
    items: [],
  },
  freshness: {
    updatedAt: '2026-01-01T00:00:00.000Z',
    sourceCollections: ['clinics'],
  },
  treatments: [
    {
      id: 't1',
      name: 'Treatment 1',
      priceFromUsd: 1200,
      comparisonLink: {
        href: '/listing-comparison?treatment=t1',
        label: 'Compare clinics for Treatment 1',
      },
    },
  ],
  doctors: [
    {
      id: 'd1',
      name: 'Dr. Ada',
      specialty: 'Dentistry',
      image: { src: '/doctor.jpg', alt: 'Doctor' },
      contactHref: '#contact',
    },
  ],
  beforeAfterEntries: [],
  location: {},
  contactHref: '#contact',
}

describe('ClinicDetail concept', () => {
  it('renders the clinic disclaimer in the hero-to-review flow', () => {
    render(<ClinicDetail data={baseData} />)

    expect(mocks.disclaimerNoticeComponent).toHaveBeenCalled()
    const disclaimerCall = mocks.disclaimerNoticeComponent.mock.calls.at(0) as unknown as Array<unknown> | undefined
    const disclaimerProps = disclaimerCall?.[0] as
      | {
          copy: string
          routeLabel: string
          variant: string
          size: string
          showVariantLabel: boolean
        }
      | undefined

    expect(disclaimerProps).toEqual(
      expect.objectContaining({
        copy: DISCLAIMER_COPY.clinicProfiles,
        routeLabel: 'Clinic profiles',
        variant: 'inline-note',
        size: 'compact',
        showVariantLabel: false,
      }),
    )

    const heroCall = mocks.heroOverviewSection.mock.calls.at(0) as unknown as Array<unknown> | undefined
    const heroProps = heroCall?.[0] as { breadcrumbs?: unknown } | undefined
    expect(heroProps?.breadcrumbs).toEqual(baseData.breadcrumbs)

    const stripCall = mocks.treatmentsStrip.mock.calls.at(0) as unknown as Array<unknown> | undefined
    const stripProps = stripCall?.[0] as { items?: Array<{ comparisonLink?: unknown }> } | undefined
    expect(stripProps?.items?.[0]?.comparisonLink).toEqual(baseData.treatments[0]?.comparisonLink)
  })
})
