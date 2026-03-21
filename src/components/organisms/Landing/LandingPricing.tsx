import React from 'react'
import { Check, Layers3, TrendingUp } from 'lucide-react'

import { Heading } from '@/components/atoms/Heading'
import { Button } from '@/components/atoms/button'
import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { cn } from '@/utilities/ui'

export type LandingPricingPlan = {
  price: string
  plan: string
  description: string
  buttonText: string
  billingLabel?: string
  highlights?: string[]
  badge?: string
  layout?: 'primary' | 'compact'
}

export type LandingPricingModelItem = {
  title: string
  description: string
}

type LandingPricingProps = {
  plans: LandingPricingPlan[]
  title: string
  description: string
  modelItems?: LandingPricingModelItem[]
}

const modelIcons = [Layers3, TrendingUp, Check] as const

export const LandingPricing: React.FC<LandingPricingProps> = ({ plans, title, description, modelItems = [] }) => {
  const primaryPlans = plans.filter((plan) => plan.layout !== 'compact')
  const compactPlans = plans.filter((plan) => plan.layout === 'compact')

  return (
    <section className="relative overflow-hidden bg-muted/30 py-20">
      <div className="absolute inset-0 bg-linear-to-br from-sky-50/70 via-white to-emerald-50/40" aria-hidden="true" />

      <Container className="relative z-10">
        <div className="mb-14">
          <p className="mb-4 text-center text-xs font-semibold tracking-[0.28em] text-secondary uppercase">
            Subscription model
          </p>
          <SectionHeading title={title} description={description} size="section" align="center" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {primaryPlans.map((plan, index) => (
            <article
              key={`${plan.plan}-${index}`}
              className={cn(
                'flex h-full flex-col rounded-[32px] border border-slate-200/80 p-8 shadow-[0_30px_90px_-58px_rgba(15,23,42,0.35)] backdrop-blur',
                index === 0 ? 'bg-linear-to-br from-white via-sky-50/70 to-white' : 'bg-white/95',
              )}
            >
              <div className="mb-8 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold tracking-[0.22em] text-slate-500 uppercase">{plan.plan}</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-5xl font-bold tracking-tight text-foreground">{plan.price}</span>
                    {plan.billingLabel ? (
                      <span className="pb-2 text-sm font-medium text-slate-500">{plan.billingLabel}</span>
                    ) : null}
                  </div>
                </div>

                {plan.badge ? (
                  <span className="rounded-full border border-secondary/15 bg-secondary/10 px-3 py-1 text-xs font-semibold text-secondary">
                    {plan.badge}
                  </span>
                ) : null}
              </div>

              <Heading as="h3" size="h5" align="left" className="mb-3 text-left">
                Built for steady partner growth
              </Heading>
              <p className="mb-8 flex-grow text-base leading-7 text-muted-foreground">{plan.description}</p>

              {plan.highlights?.length ? (
                <ul className="mb-8 space-y-3">
                  {plan.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-3 text-sm leading-6 text-slate-700">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-secondary">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="mb-8" />
              )}

              <Button
                variant="outline"
                size="lg"
                className="w-full rounded-full border-secondary/40 bg-white/80 text-secondary hover:bg-secondary hover:text-white"
              >
                {plan.buttonText}
              </Button>
            </article>
          ))}
        </div>

        {compactPlans.map((plan, index) => (
          <article
            key={`${plan.plan}-${index}`}
            className="mt-6 rounded-[30px] border border-slate-200/80 bg-white/92 p-6 shadow-[0_28px_80px_-62px_rgba(15,23,42,0.35)]"
          >
            <div className="grid gap-6 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)_auto] lg:items-center">
              <div>
                <p className="text-sm font-semibold tracking-[0.22em] text-slate-500 uppercase">{plan.plan}</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-bold tracking-tight text-foreground">{plan.price}</span>
                  {plan.billingLabel ? (
                    <span className="pb-1.5 text-sm font-medium text-slate-500">{plan.billingLabel}</span>
                  ) : null}
                </div>
              </div>

              <div>
                <Heading as="h3" size="h6" align="left" className="mb-2 text-left">
                  A lean starting point for first visibility
                </Heading>
                <p className="mb-4 text-sm leading-6 text-muted-foreground">{plan.description}</p>

                {plan.highlights?.length ? (
                  <ul className="flex flex-col gap-2 text-sm leading-6 text-slate-700 md:flex-row md:flex-wrap md:gap-x-6">
                    {plan.highlights.map((highlight) => (
                      <li key={highlight} className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-secondary" />
                        <span>{highlight}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <Button
                variant="outline"
                size="lg"
                className="w-full rounded-full border-secondary/40 text-secondary hover:bg-secondary hover:text-white lg:w-auto"
              >
                {plan.buttonText}
              </Button>
            </div>
          </article>
        ))}

        {modelItems.length > 0 ? (
          <div className="mt-6 grid gap-4 rounded-[30px] border border-slate-200/80 bg-white/80 p-6 shadow-[0_20px_60px_-50px_rgba(15,23,42,0.3)] md:grid-cols-3">
            {modelItems.map((item, index) => {
              const Icon = modelIcons[index] ?? Check

              return (
                <div key={item.title} className="flex gap-4">
                  <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-white">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </Container>
    </section>
  )
}
