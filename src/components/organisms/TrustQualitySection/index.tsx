import React from 'react'
import { CheckCircle2 } from 'lucide-react'

import { Container } from '@/components/molecules/Container'
import { cn } from '@/utilities/ui'

import { AnimatedCountUp } from './AnimatedCountUp'

export type TrustQualityStatBase = {
  label: string
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: true }>
}

export type TrustQualityNumericStat = TrustQualityStatBase & {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  locale?: string
}

export type TrustQualityTextStat = TrustQualityStatBase & {
  valueText: string
}

export type TrustQualityStat = TrustQualityNumericStat | TrustQualityTextStat

export const formatTrustQualityStatValue = (
  stat: TrustQualityNumericStat,
  rawValue: number = stat.value,
  locale: string = stat.locale ?? 'en-US',
): string => {
  const decimals = stat.decimals ?? 0

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(rawValue)

  return `${stat.prefix ?? ''}${formatted}${stat.suffix ?? ''}`
}

const isNumericStat = (stat: TrustQualityStat): stat is TrustQualityNumericStat => 'value' in stat

export type TrustQualitySectionProps = {
  title: string
  subtitle?: string
  stats: TrustQualityStat[]
  badges?: string[]
  numberLocale?: string
  className?: string
}

export const TrustQualitySection: React.FC<TrustQualitySectionProps> = ({
  title,
  subtitle,
  stats,
  badges,
  numberLocale,
  className,
}) => {
  return (
    <section className={cn('bg-accent py-16', className)} aria-labelledby="trust-quality-title">
      <Container className="flex flex-col gap-12">
        <header className="flex flex-col items-center gap-4 text-center">
          <h2 id="trust-quality-title" className="text-4xl leading-10 font-bold text-foreground">
            {title}
          </h2>
          {subtitle ? (
            <p className="max-w-2xl text-lg leading-7 whitespace-pre-line text-secondary/80">{subtitle}</p>
          ) : null}
        </header>

        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key metrics">
          {stats.map((stat, index) => (
            <li key={`${stat.label}-${index}`} className="min-h-40 rounded-xl border border-border bg-card shadow-xs">
              <div className="flex h-full flex-col items-center justify-center px-6 py-6 text-center">
                <stat.Icon className="mb-3 size-10 text-primary" aria-hidden={true} />
                <p className="text-3xl leading-9 font-bold text-foreground">
                  {isNumericStat(stat) ? (
                    <AnimatedCountUp
                      value={stat.value}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      decimals={stat.decimals}
                      locale={stat.locale ?? numberLocale}
                    />
                  ) : (
                    stat.valueText
                  )}
                </p>
                <p className="mt-1 text-sm leading-5 text-secondary/80">{stat.label}</p>
              </div>
            </li>
          ))}
        </ul>

        {badges && badges.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-4" aria-label="Certifications">
            {badges.map((badge) => (
              <li key={badge}>
                <div className="inline-flex items-center gap-2 rounded-md bg-background px-4 py-2">
                  <CheckCircle2 className="size-4 text-primary" aria-hidden={true} />
                  <span className="text-sm leading-5 font-medium text-foreground">{badge}</span>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Container>
    </section>
  )
}
