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
          <h2 className="text-foreground mb-6 text-5xl font-bold">Pricing</h2>
          <p className="text-foreground/80 mx-auto max-w-2xl text-xl">
            Quidam officiis similique sea ei, vel tollit indoctum efficiendi ei, at nihil tantas platonem eos.
          </p>
          <div className="mt-8 flex justify-end">
            <Button
              variant="outline"
              className="border-secondary text-secondary hover:bg-secondary rounded-full hover:text-white"
            >
              Pricing
            </Button>
          </div>
        </div>

        <div className="grid gap-8 md:grid-cols-2">
          {plans.map((plan, index) => (
            <div key={index} className="border-border flex flex-col rounded-3xl border bg-white p-12 shadow-sm">
              <div className="text-foreground mb-8 text-6xl font-bold">{plan.price}</div>
              <h3 className="text-foreground mb-4 text-2xl font-bold">{plan.plan}</h3>
              <p className="text-muted-foreground mb-8 flex-grow text-lg">{plan.description}</p>
              <Button
                variant="outline"
                size="lg"
                className="border-secondary text-secondary hover:bg-secondary w-full rounded-lg hover:text-white"
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
