import * as React from 'react'
import { Star, Facebook, Linkedin, Twitter, Clock, Phone, MessageCircle, ArrowRight } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { cn } from '@/utilities/ui'

import type { DoctorCardData, DoctorSocialLink } from './types'

function clampRating(value: number) {
  return Math.max(0, Math.min(5, value))
}

function RatingStars({ value, className }: { value: number; className?: string }) {
  const clamped = clampRating(value)
  const filled = Math.round(clamped)

  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      role="img"
      aria-label={`Rating ${clamped.toFixed(1)} out of 5`}
    >
      {Array.from({ length: 5 }).map((_, idx) => {
        const isFilled = idx < filled
        return (
          <Star
            key={idx}
            className={cn('size-4', isFilled ? 'fill-primary text-primary' : 'fill-muted text-muted')}
            aria-hidden="true"
          />
        )
      })}
    </div>
  )
}

function SocialIcon({ link }: { link: DoctorSocialLink }) {
  const Icon =
    link.kind === 'facebook' ? Facebook : link.kind === 'linkedin' ? Linkedin : link.kind === 'twitter' ? Twitter : null

  if (!Icon) return null

  return (
    <a
      href={link.href}
      aria-label={link.label}
      className="inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
    <article className={cn('overflow-hidden rounded-2xl bg-card shadow-brand-soft', className)}>
      <div className="p-6 md:p-8">
        <div className="flex items-start gap-6">
          <div className="min-w-0 flex-1">
            <Heading className="truncate text-2xl font-semibold leading-tight text-secondary md:text-3xl">
              {data.name}
            </Heading>
            {data.subtitle ? <p className="mt-1 text-base text-secondary">{data.subtitle}</p> : null}
            {data.description ? (
              <p className="mt-2 max-w-prose text-sm leading-relaxed text-secondary/60">{data.description}</p>
            ) : null}

            {data.socialLinks?.length ? (
              <div className="mt-4 flex items-center gap-2" aria-label="Social links">
                {data.socialLinks.map((link) => (
                  <SocialIcon key={`${link.kind}-${link.href}`} link={link} />
                ))}
              </div>
            ) : null}
          </div>

          {data.rating ? (
            <div className="shrink-0 text-right">
              <RatingStars value={data.rating.value} className="justify-end" />
              <div className="mt-1 text-xs text-secondary/60">{data.rating.value.toFixed(1)}/5</div>
              <div className="mt-0.5 text-xs text-secondary/60">{data.rating.reviewCount} Reviews</div>
            </div>
          ) : null}
        </div>
      </div>

      {data.actions ? (
        <nav aria-label="Doctor actions" className="bg-primary px-4 py-3 md:px-8 md:py-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {data.actions.availability ? (
                <a
                  href={data.actions.availability.href}
                  className="inline-flex items-center gap-2 text-sm text-primary-foreground/90 hover:text-primary-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Clock className="size-4" aria-hidden="true" />
                  <span>{data.actions.availability.label}</span>
                </a>
              ) : null}

              {data.actions.call ? (
                <a
                  href={data.actions.call.href}
                  className="inline-flex items-center gap-2 text-sm text-primary-foreground/90 hover:text-primary-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <Phone className="size-4" aria-hidden="true" />
                  <span>{data.actions.call.label}</span>
                </a>
              ) : null}

              {data.actions.chat ? (
                <a
                  href={data.actions.chat.href}
                  className="inline-flex items-center gap-2 text-sm text-primary-foreground/90 hover:text-primary-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <MessageCircle className="size-4" aria-hidden="true" />
                  <span>{data.actions.chat.label}</span>
                </a>
              ) : null}
            </div>

            {data.actions.booking ? (
              <Button asChild variant="link" size="clear" className="ml-auto text-primary-foreground underline">
                <a aria-label={data.actions.booking.label} href={data.actions.booking.href}>
                  {data.actions.booking.label}
                  <ArrowRight className="ml-2 size-4" aria-hidden="true" />
                </a>
              </Button>
            ) : null}
          </div>
        </nav>
      ) : null}
    </article>
  )
}
