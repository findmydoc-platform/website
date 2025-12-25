import React from 'react'
import Link from 'next/link'

import { Button } from '@/components/atoms/button'
import { Container } from '@/components/molecules/Container'
import { clinicCTAData } from '@/stories/fixtures/clinics'

export const ClinicCTA: React.FC = () => {
  const { title, buttonText, buttonLink } = clinicCTAData

  return (
    <section className="py-20">
      <Container>
        <div className="relative overflow-hidden rounded-[20px] bg-accent px-8 py-16 md:px-16 md:py-24">
          <div className="flex flex-col items-center justify-between gap-8 md:flex-row">
            <h2 className="max-w-2xl text-4xl font-bold text-foreground md:text-5xl">{title}</h2>
            <Button asChild size="lg" className="bg-secondary text-white hover:bg-secondary/90">
              <Link href={buttonLink}>{buttonText}</Link>
            </Button>
          </div>
        </div>
      </Container>
    </section>
  )
}
