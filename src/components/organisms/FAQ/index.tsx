'use client'

import React from 'react'

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/atoms/accordion'
import { Container } from '@/components/molecules/Container'
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
    <section className={cn('py-16 md:py-20', className)} aria-labelledby={titleId}>
      <Container>
        <header className="mx-auto flex max-w-4xl flex-col items-center gap-4 text-center">
          <h2 id={titleId} className="text-size-56 font-bold text-foreground">
            {title}
          </h2>
          {description ? <p className="text-big text-muted-foreground">{description}</p> : null}
        </header>

        <div className="mt-10 w-full">
          <Accordion type="single" collapsible defaultValue={defaultOpenItemId} className="flex flex-col gap-4">
            {items.map((item) => (
              <AccordionItem
                key={item.id}
                value={item.id}
                className="overflow-hidden rounded-3xl border-0 bg-card shadow-elevated-strong"
              >
                <AccordionTrigger className="bg-accent px-6 py-6 text-2xl font-bold text-black hover:no-underline md:px-10">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="px-6 text-left text-lg leading-8 text-foreground md:px-10 md:text-xl">
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
