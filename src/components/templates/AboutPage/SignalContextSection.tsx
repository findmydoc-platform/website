import React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { TrustAtom } from '@/components/atoms/TrustAtom'
import { Container } from '@/components/molecules/Container'

import type { AboutTextSection } from './types'
import { getAtomMotion, getSignalItem } from './aboutPageUtils'

export const SignalContextSection: React.FC<{ section: AboutTextSection }> = ({ section }) => {
  return (
    <section
      className="relative overflow-hidden pt-14 pb-8 sm:pt-18 sm:pb-10 lg:pt-20 lg:pb-8"
      aria-labelledby="about-signal-context-heading"
    >
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.5fr)] lg:items-start lg:gap-16">
          <div className="max-w-sm" data-about-signal-reveal="">
            <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Before trust</p>
            <Heading id="about-signal-context-heading" as="h2" align="left" size="h4" className="mt-3 text-secondary">
              {section.title}
            </Heading>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {section.items.map((item, index) => {
              const signal = getSignalItem(index)
              const motion = getAtomMotion(index)

              return (
                <article key={`${section.title}-${index}`} className="min-w-0 pt-5 sm:pt-6">
                  <div data-about-signal-reveal="">
                    <TrustAtom tone={signal.tone} animated className="mb-5" {...motion} />
                  </div>
                  <div data-about-signal-reveal="">
                    <p className="text-xs font-semibold tracking-[0.16em] text-secondary/52 uppercase">
                      {signal.label}
                    </p>
                    <Heading as="h3" align="left" size="h6" className="mt-2 text-secondary">
                      {signal.title}
                    </Heading>
                    <p className="mt-4 text-base leading-7 text-secondary/76">{item.text}</p>
                  </div>
                </article>
              )
            })}
          </div>
        </div>
        <div className="mt-8 border-t border-site-divider/70 sm:mt-10 lg:mt-8" aria-hidden="true" />
      </Container>
    </section>
  )
}
