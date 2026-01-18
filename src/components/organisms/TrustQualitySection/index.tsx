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
          <h2 id="trust-quality-title" className="text-foreground text-4xl leading-10 font-bold">
            {title}
          </h2>
          {subtitle ? (
            <p className="text-secondary/80 max-w-2xl text-lg leading-7 whitespace-pre-line">{subtitle}</p>
          ) : null}
        </header>

        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-label="Key metrics">
          {stats.map((stat, index) => (
            <li key={`${stat.label}-${index}`} className="border-border bg-card min-h-40 rounded-xl border shadow-xs">
              <div className="flex h-full flex-col items-center justify-center px-6 py-6 text-center">
                <stat.Icon className="text-primary mb-3 size-10" aria-hidden={true} />
                <p className="text-foreground text-3xl leading-9 font-bold">
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
                <p className="text-secondary/80 mt-1 text-sm leading-5">{stat.label}</p>
              </div>
            </li>
          ))}
        </ul>

        {badges && badges.length > 0 ? (
          <ul className="flex flex-wrap justify-center gap-4" aria-label="Certifications">
            {badges.map((badge) => (
              <li key={badge}>
                <div className="bg-background inline-flex items-center gap-2 rounded-md px-4 py-2">
                  <CheckCircle2 className="text-primary size-4" aria-hidden={true} />
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
