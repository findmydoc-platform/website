import React from 'react'
import Image from 'next/image'

import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'

const LANDING_CONTACT_BACKGROUND_SRC = '/images/landing/contact-background.png'
const LANDING_CONTACT_FUNNEL_SRC = '/images/landing/contact-funnel-900x300.png'

type LandingContactProps = {
  title: string
  description: string
}

export const LandingContact: React.FC<LandingContactProps> = ({ title, description }) => {
  return (
    <section className="relative min-h-116 overflow-hidden bg-white py-20">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 z-0">
        <Image
          src={LANDING_CONTACT_BACKGROUND_SRC}
          alt="Contact Background"
          fill
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-white/70" />
      </div>

      <Container className="relative z-10">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <SectionHeading
              title={title}
              description={description}
              size="section"
              align="left"
              descriptionClassName="max-w-md text-2xl leading-relaxed font-bold text-foreground"
            />
          </div>

          <div className="flex min-h-75 items-center justify-center rounded-lg bg-white shadow-lg lg:col-span-8">
            <Image
              src={LANDING_CONTACT_FUNNEL_SRC}
              alt="Contact funnel illustration"
              width={900}
              height={300}
              className="h-auto max-w-full"
            />
          </div>
        </div>
      </Container>
    </section>
  )
}
