'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { ClinicSearchBar, type ClinicSearchValues } from '@/components/molecules/ClinicSearchBar'

export function LandingHeroSearchBarClient({ className }: { className?: string }) {
  const router = useRouter()
  const [values, setValues] = React.useState<ClinicSearchValues>({
    service: '',
    location: '',
    budget: '',
  })

  return (
    <ClinicSearchBar
      className={className}
      values={values}
      onValuesChange={setValues}
      onSearch={(nextValues) => {
        const params = new URLSearchParams()
        if (nextValues.service.trim().length > 0) {
          params.set('service', nextValues.service.trim())
        }
        if (nextValues.location.trim().length > 0) {
          params.set('location', nextValues.location.trim())
        }
        if (nextValues.budget.trim().length > 0) {
          params.set('budget', nextValues.budget.trim())
        }

        const query = params.toString()
        router.push(query ? `/listing-comparison?${query}` : '/listing-comparison')
      }}
    />
  )
}
