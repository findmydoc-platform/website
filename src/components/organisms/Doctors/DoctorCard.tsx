import * as React from 'react'
import { Facebook, Linkedin, Twitter, Clock, Phone, MessageCircle, ArrowRight } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { RatingSummary } from '@/components/molecules/RatingSummary'
import { cn } from '@/utilities/ui'

import type { DoctorCardData, DoctorSocialLink } from './types'

function SocialIcon({ link }: { link: DoctorSocialLink }) {
  const Icon =
    link.kind === 'facebook' ? Facebook : link.kind === 'linkedin' ? Linkedin : link.kind === 'twitter' ? Twitter : null

  if (!Icon) return null

  return (
    <a
      href={link.href}
      aria-label={link.label}
      className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring inline-flex size-8 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
    >
      <Icon className="size-4" aria-hidden="true" />
    </a>
  )
}

export type DoctorCardProps = {
  data: DoctorCardData
  className?: string
  titleAs?: 'h2' | 'h3'
}

export function DoctorCard({ data, className, titleAs = 'h3' }: DoctorCardProps) {
  const Heading = titleAs

  return (
    <article className={cn('bg-card shadow-brand-soft overflow-hidden rounded-2xl', className)}>
      <div className="p-6 md:p-8">
        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1">
            <Heading className="text-secondary truncate text-left text-2xl leading-tight font-semibold md:text-3xl">
              {data.name}
            </Heading>
            {data.subtitle ? <p className="text-secondary mt-1 text-base">{data.subtitle}</p> : null}
            {data.description ? (
              <p className="text-secondary/60 mt-2 max-w-prose text-sm leading-relaxed">{data.description}</p>
            ) : null}

            {data.socialLinks?.length ? (
              <div className="mt-4 flex items-center gap-2" aria-label="Social links">
                {data.socialLinks.map((link) => (
                  <SocialIcon key={`${link.kind}-${link.href}`} link={link} />
                ))}
              </div>
            ) : (
              <div className="mt-4 h-8" aria-hidden="true" />
            )}
          </div>

          {data.rating ? (
            <div className="shrink-0">
              <RatingSummary
                value={data.rating.value}
                count={data.rating.reviewCount}
                variant="stacked"
                countFormat="reviews"
              />
            </div>
          ) : null}
        </div>
      </div>

      {data.actions ? (
        <nav aria-label="Doctor actions" className="bg-primary px-4 py-5 md:px-8 md:py-6">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            {data.actions.availability ? (
              <a
                href={data.actions.availability.href}
                className="text-primary-foreground/90 hover:text-primary-foreground focus-visible:ring-ring inline-flex items-center gap-2.5 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <Clock className="size-5" aria-hidden="true" />
                <span>{data.actions.availability.label}</span>
              </a>
            ) : null}

            {data.actions.call ? (
              <a
                href={data.actions.call.href}
                className="text-primary-foreground/90 hover:text-primary-foreground focus-visible:ring-ring inline-flex items-center gap-2.5 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <Phone className="size-5" aria-hidden="true" />
                <span>{data.actions.call.label}</span>
              </a>
            ) : null}

            {data.actions.chat ? (
              <a
                href={data.actions.chat.href}
                className="text-primary-foreground/90 hover:text-primary-foreground focus-visible:ring-ring inline-flex items-center gap-2.5 text-base focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden"
              >
                <MessageCircle className="size-5" aria-hidden="true" />
                <span>{data.actions.chat.label}</span>
              </a>
            ) : null}

            {data.actions.booking ? (
              <Button
                asChild
                variant="link"
                size="clear"
                className="text-primary-foreground ml-auto text-base font-medium underline"
              >
                <a aria-label={data.actions.booking.label} href={data.actions.booking.href}>
                  {data.actions.booking.label}
                  <ArrowRight className="ml-2 size-5" aria-hidden="true" />
                </a>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </article>
  )
}
