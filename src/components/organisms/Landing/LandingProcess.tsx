import React from 'react'
import Image from 'next/image'

import { Container } from '@/components/molecules/Container'
import ph572x967 from '@/stories/assets/placeholder-572-967.png'

type LandingProcessStep = {
  step: number
  title: string
  description: string
}

type LandingProcessProps = {
  steps: LandingProcessStep[]
}

export const LandingProcess: React.FC<LandingProcessProps> = ({ steps }) => {
  const step1 = steps[0]
  const step2 = steps[1]
  const step3 = steps[2]
  const step4 = steps[3]

  if (!step1 || !step2 || !step3 || !step4) return null

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
          <div className="relative min-h-[9.375rem] overflow-hidden rounded-3xl">
            <Image src={ph572x967} alt="Process Image" fill className="object-cover" />
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
                <span className="text-5xl font-bold text-foreground leading-none">{step1.step}.</span>
                <div className="flex flex-col pt-1">
                  <h3 className="mb-2 text-xl font-bold text-foreground">{step1.title}</h3>
                  <p className="text-lg text-muted-foreground">{step1.description}</p>
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="relative pl-12 lg:ml-20">
              <div className="absolute left-3 top-3 z-10 h-4 w-4 rounded-full bg-primary" />
              <div className="flex flex-row items-start gap-4">
                <span className="text-5xl font-bold text-foreground leading-none">{step2.step}.</span>
                <div className="flex flex-col pt-1">
                  <h3 className="mb-2 text-xl font-bold text-foreground">{step2.title}</h3>
                  <p className="text-lg text-muted-foreground">{step2.description}</p>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="relative pl-12 lg:ml-20">
              <div className="absolute left-3 top-3 z-10 h-4 w-4 rounded-full bg-primary" />
              <div className="flex flex-row items-start gap-4">
                <span className="text-5xl font-bold text-foreground leading-none">{step3.step}.</span>
                <div className="flex flex-col pt-1">
                  <h3 className="mb-2 text-xl font-bold text-foreground">{step3.title}</h3>
                  <p className="text-lg text-muted-foreground">{step3.description}</p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="relative pl-12 lg:ml-4">
              <div className="absolute left-3 top-3 z-10 h-4 w-4 rounded-full bg-primary" />
              <div className="flex flex-row items-start gap-4">
                <span className="text-5xl font-bold text-foreground leading-none">{step4.step}.</span>
                <div className="flex flex-col pt-1">
                  <h3 className="mb-2 text-xl font-bold text-foreground">{step4.title}</h3>
                  <p className="text-lg text-muted-foreground">{step4.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  )
}
