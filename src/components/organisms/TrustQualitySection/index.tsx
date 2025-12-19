import React from 'react'
import { Award, BadgeCheck, CheckCircle2, Shield, Users } from 'lucide-react'

import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

export type TrustQualityStat = {
  value: string
  label: string
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: true }>
}

export type TrustQualitySectionProps = {
  title: string
  subtitle?: string
  stats?: TrustQualityStat[]
  badges?: string[]
  className?: string
}

const defaultStats: TrustQualityStat[] = [
  { value: '500+', label: 'Verified clinics', Icon: Users },
  { value: '1,200+', label: 'Treatment types', Icon: BadgeCheck },
  { value: '98%', label: 'Satisfaction rate', Icon: Award },
  { value: 'TÜV', label: 'Verified platform', Icon: Shield },
]

const defaultBadges = ['TÜV SÜD certified', 'GDPR compliant', 'Verified clinic data', 'Privacy guaranteed']

export const TrustQualitySection: React.FC<TrustQualitySectionProps> = ({
  title,
  subtitle,
  stats = defaultStats,
  badges = defaultBadges,
  className,
}) => {
  return (
    <section className={cn('bg-accent py-16', className)} aria-labelledby="trust-quality-title">
      <Container className="flex flex-col gap-12">
        <header className="flex flex-col items-center gap-4 text-center">
          <h2 id="trust-quality-title" className="text-foreground text-4xl leading-10 font-bold">
            {title}
          </h2>
          {subtitle ? (
            <p className="max-w-2xl whitespace-pre-line text-lg leading-7 text-secondary/80">{subtitle}</p>
          ) : null}
        </header>

        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key metrics">
          {stats.map(({ value, label, Icon }) => (
            <li key={`${value}-${label}`} className="min-h-40 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex h-full flex-col items-center justify-center px-6 py-6 text-center">
                <Icon className="mb-3 size-10 text-primary" aria-hidden={true} />
                <p className="text-foreground text-3xl leading-9 font-bold">{value}</p>
                <p className="mt-1 text-sm leading-5 text-secondary/80">{label}</p>
              </div>
            </li>
          ))}
        </ul>

        {badges.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-4" aria-label="Certifications">
            {badges.map((badge) => (
              <li key={badge}>
                <div className="inline-flex items-center gap-2 rounded-md bg-background px-4 py-2">
                  <CheckCircle2 className="size-4 text-accent" aria-hidden={true} />
                  <span className="text-foreground text-sm leading-5 font-medium">{badge}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
    </section>
  )
}

export const TrustQualitySectionDefaults = {
  stats: defaultStats,
  badges: defaultBadges,
}
