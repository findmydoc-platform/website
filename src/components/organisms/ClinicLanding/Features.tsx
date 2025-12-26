import React from 'react'

import { Container } from '@/components/molecules/Container'

type ClinicFeature = {
  title: string
  description: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
}

type ClinicFeaturesProps = {
  features: ClinicFeature[]
}

export const ClinicFeatures: React.FC<ClinicFeaturesProps> = ({ features }) => {
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
              <div key={index} className="flex flex-col items-start">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-8 w-8 text-foreground" />
                </div>
                <h3 className="mb-4 text-2xl font-bold text-foreground">{feature.title}</h3>
                <p className="text-lg text-muted-foreground">{feature.description}</p>
              </div>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
