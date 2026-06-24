import React from 'react'

import { Heading } from '@/components/atoms/Heading'
import { TrustAtom } from '@/components/atoms/TrustAtom'
import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

import type { AboutTextSection } from './types'
import { getAtomMotion, getBoundaryItem, getSignalItem } from './aboutPageUtils'

export const BoundarySection: React.FC<{ section: AboutTextSection }> = ({ section }) => {
  return (
    <section className="bg-site-section/60" aria-labelledby="about-boundary-heading">
      <Container>
        <div className="grid gap-10 border-y border-site-divider/70 py-14 sm:py-18 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.5fr)] lg:gap-16 lg:py-20">
          <div className="max-w-sm" data-about-boundary-reveal="">
            <p className="text-sm font-semibold tracking-[0.18em] text-primary uppercase">Trust boundaries</p>
            <Heading id="about-boundary-heading" as="h2" align="left" size="h4" className="mt-3 text-secondary">
              {section.title}
            </Heading>
          </div>
          <ol className="grid gap-3">
            {section.items.map((item, index) => {
              const boundary = getBoundaryItem(index)
              const atom = getSignalItem(index)
              const motion = getAtomMotion(index)

              return (
                <li
                  key={`${section.title}-${index}`}
                  className={cn(
                    'grid gap-4 pt-[30px] pb-5 sm:grid-cols-[minmax(0,0.56fr)_minmax(0,1fr)] sm:items-start sm:gap-8',
                    index > 0 && 'border-t border-site-divider/70',
                  )}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div data-about-boundary-reveal="">
                      <TrustAtom tone={atom.tone} animated {...motion} />
                    </div>
                    <div className="min-w-0" data-about-boundary-reveal="">
                      <p className="text-xs font-semibold tracking-[0.16em] text-secondary/50 uppercase">
                        {boundary.label}
                      </p>
                      <Heading as="h3" align="left" size="h6" className="mt-1 text-secondary">
                        {boundary.title}
                      </Heading>
                    </div>
                  </div>
                  <p className="text-base leading-7 text-secondary/76" data-about-boundary-reveal="">
                    {item.text}
                  </p>
                </li>
              )
            })}
          </ol>
        </div>
      </Container>
    </section>
  )
}
