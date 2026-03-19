import React from 'react'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { HoldingPageContactForm } from '@/components/templates/HoldingPageConcept/ContactForm.client'
import {
  DEFAULT_CONTACT_FORM_LABELS,
  DEFAULT_CONTACT_FORM_SLUG,
  type HoldingPageContactFormLabels,
} from '@/components/templates/HoldingPageConcept/contactForm.shared'

type LandingContactProps = {
  contactConsent?: string
  contactEyebrow?: string
  contactFormLabels?: HoldingPageContactFormLabels
  contactFormSlug?: string
  contactMode?: 'compact' | 'full'
  description: string
  primaryCtaLabel?: string
  title: string
}

export const LandingContact: React.FC<LandingContactProps> = ({
  contactConsent,
  contactEyebrow = 'Contact',
  contactFormLabels,
  contactFormSlug,
  contactMode = 'full',
  description,
  primaryCtaLabel = 'Send message',
  title,
}) => {
  const consentCopy =
    contactConsent ?? 'By sending this request, you agree that findmydoc may contact you about your inquiry.'

  return (
    <section className="relative overflow-hidden py-20">
      <div className="absolute inset-0 bg-linear-to-br from-sky-50 via-white to-slate-50" aria-hidden="true" />
      <div className="absolute inset-x-0 top-0 h-px bg-slate-200/70" aria-hidden="true" />

      <Container className="relative z-10">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:items-start">
          <SectionHeading
            title={title}
            description={description}
            size="section"
            align="left"
            headingAs="h2"
            titleClassName="max-w-xl"
            descriptionClassName="max-w-xl"
          />

          <div className="rounded-[32px] border border-slate-200/80 bg-white/92 p-5 shadow-[0_30px_100px_-56px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-[0.28em] text-slate-500 uppercase">{contactEyebrow}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {contactMode === 'compact'
                    ? 'Leave your email and we will follow up with the next step.'
                    : 'Share your details and send the request directly through the form below.'}
                </p>
              </div>
              <span className="inline-flex shrink-0 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                {contactMode === 'compact' ? 'Quick contact' : 'Direct contact'}
              </span>
            </div>

            <HoldingPageContactForm
              contactMode={contactMode}
              contactFormSlug={contactFormSlug?.trim() || DEFAULT_CONTACT_FORM_SLUG}
              labels={contactFormLabels ?? DEFAULT_CONTACT_FORM_LABELS}
              primaryCtaLabel={primaryCtaLabel}
            />

            <p className="mt-4 text-xs leading-5 text-slate-500">{consentCopy}</p>
          </div>
        </div>
      </Container>
    </section>
  )
}
