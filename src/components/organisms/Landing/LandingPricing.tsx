import React from 'react'

import { Button } from '@/components/atoms/button'
import { Container } from '@/components/molecules/Container'

type LandingPricingPlan = {
  price: string
  plan: string
  description: string
  buttonText: string
}

type LandingPricingProps = {
  plans: LandingPricingPlan[]
}

export const LandingPricing: React.FC<LandingPricingProps> = ({ plans }) => {
  return (
    <section className="bg-muted/30 py-20">
      <Container>
        <div className="mb-16">
          <h2 className="mb-6 text-5xl font-bold text-foreground">Pricing</h2>
          <p className="mx-auto max-w-2xl text-xl text-foreground/80">
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
          <div className="mt-8 flex justify-end">
            <Button
              variant="outline"
              className="rounded-full border-secondary text-secondary hover:bg-secondary hover:text-white"
            >
              Pricing
            </Button>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {plans.map((plan, index) => (
            <div key={index} className="flex flex-col rounded-3xl border border-border bg-white p-12 shadow-sm">
              <div className="mb-8 text-6xl font-bold text-foreground">{plan.price}</div>
              <h3 className="mb-4 text-2xl font-bold text-foreground">{plan.plan}</h3>
              <p className="mb-8 flex-grow text-lg text-muted-foreground">{plan.description}</p>
              <Button
                variant="outline"
                size="lg"
                className="w-full rounded-lg border-secondary text-secondary hover:bg-secondary hover:text-white"
              >
                {plan.buttonText}
              </Button>
            </div>
          ))}
        </div>
      </Container>
    </section>
  )
}
