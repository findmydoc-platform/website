import * as React from 'react'
import { cn } from '@/utilities/ui'

export type PriceSummaryFrom = {
  value: number
  currency: string
  label: string
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(value)
}

export function PriceSummary({ priceFrom, className }: { priceFrom: PriceSummaryFrom; className?: string }) {
  if (!priceFrom) return null

  return (
    <div className={cn('mb-2 md:float-right md:mb-1 md:ml-4 md:text-right', className)}>
      <div className="text-muted-foreground text-base font-semibold">{priceFrom.label}</div>
      <div className="text-primary text-4xl font-bold tracking-tight">
        {formatMoney(priceFrom.value, priceFrom.currency)}
      </div>
    </div>
  )
}

export default PriceSummary
