import React from 'react'
import Image from 'next/image'

import { Container } from '@/components/molecules/Container'
import { clinicProcessData } from '@/stories/fixtures/clinics'
import { cn } from '@/utilities/ui'

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

          <div className="relative flex flex-col justify-center space-y-12 py-8">
            {/* Curved connecting line */}
            <div className="absolute left-0 top-4 bottom-4 w-24 hidden lg:block pointer-events-none">
              <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                <path
                  d="M 20 0 C 80 25, 80 75, 20 100"
                  fill="none"
                  stroke="hsl(var(--border))"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            </div>

            {/* Step 1 */}
            <div className="relative pl-12 lg:ml-4">
              <div className="absolute left-3 top-3 z-10 h-4 w-4 rounded-full bg-primary" />
              <div className="flex flex-row items-start gap-4">
                <span className="text-5xl font-bold text-foreground leading-none">{clinicProcessData[0].step}.</span>
                <div className="flex flex-col pt-1">
                  <h3 className="mb-2 text-xl font-bold text-foreground">{clinicProcessData[0].title}</h3>
                  <p className="text-lg text-muted-foreground">{clinicProcessData[0].description}</p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative pl-12 lg:ml-20">
              <div className="absolute left-3 top-3 z-10 h-4 w-4 rounded-full bg-primary" />
              <div className="flex flex-row items-start gap-4">
                <span className="text-5xl font-bold text-foreground leading-none">{clinicProcessData[1].step}.</span>
                <div className="flex flex-col pt-1">
                  <h3 className="mb-2 text-xl font-bold text-foreground">{clinicProcessData[1].title}</h3>
                  <p className="text-lg text-muted-foreground">{clinicProcessData[1].description}</p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative pl-12 lg:ml-20">
              <div className="absolute left-3 top-3 z-10 h-4 w-4 rounded-full bg-primary" />
              <div className="flex flex-row items-start gap-4">
                <span className="text-5xl font-bold text-foreground leading-none">{clinicProcessData[2].step}.</span>
                <div className="flex flex-col pt-1">
                  <h3 className="mb-2 text-xl font-bold text-foreground">{clinicProcessData[2].title}</h3>
                  <p className="text-lg text-muted-foreground">{clinicProcessData[2].description}</p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative pl-12 lg:ml-4">
              <div className="absolute left-3 top-3 z-10 h-4 w-4 rounded-full bg-primary" />
              <div className="flex flex-row items-start gap-4">
                <span className="text-5xl font-bold text-foreground leading-none">{clinicProcessData[3].step}.</span>
                <div className="flex flex-col pt-1">
                  <h3 className="mb-2 text-xl font-bold text-foreground">{clinicProcessData[3].title}</h3>
                  <p className="text-lg text-muted-foreground">{clinicProcessData[3].description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
