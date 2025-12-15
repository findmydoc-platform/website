import * as React from 'react'
import { cn } from '@/utilities/ui'

export type ClinicPriceFrom = {
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

export function ClinicPrice({ priceFrom, className }: { priceFrom: ClinicPriceFrom; className?: string }) {
  if (!priceFrom) return null

  return (
    <div className={cn('mb-2 md:float-right md:ml-4 md:mb-1 md:text-right', className)}>
      <div className="text-base font-semibold text-muted-foreground">{priceFrom.label}</div>
      <div className="text-4xl font-bold tracking-tight text-primary">
        {formatMoney(priceFrom.value, priceFrom.currency)}
      </div>
    </div>
  )
}

export default ClinicPrice
