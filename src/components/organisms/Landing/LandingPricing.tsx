import React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'

type LandingPricingPlan = {
  price: string
  plan: string
  description: string
  buttonText: string
}

type LandingPricingProps = {
  plans: LandingPricingPlan[]
  title: string
  description: string
}

export const LandingPricing: React.FC<LandingPricingProps> = ({ plans, title, description }) => {
  return (
    <section className="bg-muted/30 py-20">
      <Container>
        <div className="mb-16">
          <SectionHeading title={title} description={description} size="section" align="center" />
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
              <Heading as="h3" size="h5" align="center" className="mb-4">
                {plan.plan}
              </Heading>
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
