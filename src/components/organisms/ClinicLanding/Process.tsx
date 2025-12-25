import React from 'react'
import Image from 'next/image'

import { Container } from '@/components/molecules/Container'
import { clinicProcessData } from '@/stories/fixtures/clinics'

export const ClinicProcess: React.FC = () => {
  return (
    <section className="bg-white py-20">
      <Container>
        <div className="mb-16 text-center">
          <h2 className="mb-6 text-5xl font-bold text-foreground">Our Process</h2>
          <p className="mx-auto max-w-2xl text-xl text-foreground/80">
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
        </div>

        <div className="grid gap-12 lg:grid-cols-2">
          <div className="relative min-h-[600px] overflow-hidden rounded-[40px]">
            <Image src="https://placehold.co/572x967" alt="Process Image" fill className="object-cover" />
          </div>

          <div className="flex flex-col justify-center space-y-12">
            {clinicProcessData.map((step, index) => (
              <div key={index} className="relative pl-12">
                {/* Connecting line could be added here if needed */}
                {index < clinicProcessData.length - 1 && (
                  <div className="absolute left-[19px] top-12 h-full w-0.5 bg-border" />
                )}

                <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border-2 border-border bg-white text-lg font-bold text-foreground">
                  <div className="h-3 w-3 rounded-full bg-primary" />
                </div>

                <div className="mb-2 text-5xl font-bold text-foreground/10">{step.step}.</div>
                <h3 className="mb-2 text-2xl font-bold text-foreground">{step.title}</h3>
                <p className="text-lg text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
