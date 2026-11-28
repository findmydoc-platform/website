import * as React from 'react'

export type PriceSummaryFrom = {
  value: number
  currency: string
  label: string
}

function formatMoney(value: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function PriceSummary({
  priceFrom,
  className,
  locale = 'de-DE',
}: {
  priceFrom: PriceSummaryFrom
  className?: string
  locale?: string
}) {
  if (!priceFrom) return null

  return (
    <div className={className}>
      <div className="text-base font-semibold text-supporting-foreground">{priceFrom.label}</div>
      <div className="text-4xl font-bold tracking-tight text-primary">
        {formatMoney(priceFrom.value, priceFrom.currency, locale)}
      </div>
    </div>
  )
}
