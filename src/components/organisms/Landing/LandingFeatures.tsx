import React from 'react'

import { Container } from '@/components/molecules/Container'

type LandingFeature = {
  title: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

type LandingFeaturesProps = {
  features: LandingFeature[]
}

export const LandingFeatures: React.FC<LandingFeaturesProps> = ({ features }) => {
  return (
    <section className="bg-white py-20">
      <Container>
        <div className="mb-16">
          <h2 className="mb-6 text-5xl font-bold text-foreground">Features</h2>
          <p className="mx-auto max-w-2xl text-xl text-foreground/80">
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
        </div>

        <div className="grid gap-12 md:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <div key={index} className="flex flex-col items-start gap-4 md:flex-row md:items-start md:gap-6">
                <div className="mb-2 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted md:mb-0">
                  <Icon className="h-8 w-8 text-foreground" />
                </div>
                <div className="flex flex-col items-start gap-2">
                  <h3 className="text-5xl font-bold text-foreground text-left">{feature.title}</h3>
                  <h4 className="text-1xl font-bold text-foreground">{feature.title}</h4>
                  <p className="text-lg text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
