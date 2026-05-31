'use client'

import React from 'react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/atoms/accordion'
import { Heading } from '@/components/atoms/Heading'
import { Container } from '@/components/molecules/Container'
import { SectionHeading } from '@/components/molecules/SectionHeading'
import { cn } from '@/utilities/ui'

export type FAQItem = {
  id: string
  question: string
  answer: React.ReactNode
}

export type FAQSectionProps = {
  title: string
  description?: string
  items: FAQItem[]
  defaultOpenItemId?: string
  className?: string
}

export const FAQSection: React.FC<FAQSectionProps> = ({ title, description, items, defaultOpenItemId, className }) => {
  const titleId = React.useId()

  return (
    <section className={cn('bg-white py-14 sm:py-16 md:py-20', className)} aria-labelledby={titleId}>
      <Container>
        {description ? (
          <SectionHeading
            title={title}
            description={description}
            titleId={titleId}
            size="section"
            align="center"
            className="mx-auto max-w-3xl"
          />
        ) : (
          <header className="mx-auto max-w-3xl text-center">
            <Heading
              id={titleId}
              as="h2"
              align="center"
              className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl"
            >
              {title}
            </Heading>
          </header>
        )}

        <div className="mx-auto mt-8 w-full max-w-5xl sm:mt-10">
          <Accordion
            type="single"
            collapsible
            defaultValue={defaultOpenItemId}
            className="flex flex-col gap-3 sm:gap-4"
          >
            {items.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="scroll-mb-24 overflow-hidden rounded-2xl border border-accent/60 bg-accent shadow-[0_22px_64px_-48px_rgba(7,0,76,0.5)] transition-colors focus-within:border-primary/70"
              >
                <AccordionTrigger
                  iconClassName="h-5 w-5 text-accent-foreground"
                  className="min-h-14 cursor-pointer gap-4 bg-accent px-5 py-4 text-base leading-6 font-semibold text-accent-foreground transition-colors hover:bg-accent/90 hover:no-underline focus-visible:ring-ring data-[state=open]:bg-accent sm:min-h-16 sm:px-6 sm:py-5 sm:text-lg md:px-7"
                >
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="border-t border-accent-foreground/10 bg-white px-5 pt-4 pb-5 text-left text-sm leading-7 text-foreground/80 sm:px-6 sm:text-base md:px-7">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </Container>
    </section>
  )
}
