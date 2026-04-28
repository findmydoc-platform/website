'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import type { ComboboxOption } from '@/components/atoms/combobox'
import { ClinicSearchBar, type ClinicSearchValues } from '@/components/molecules/ClinicSearchBar'

type LandingHeroSearchBarClientProps = {
  className?: string
  serviceOptions?: ComboboxOption[]
  locationOptions?: ComboboxOption[]
}

export function LandingHeroSearchBarClient({
  className,
  serviceOptions,
  locationOptions,
}: LandingHeroSearchBarClientProps) {
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
      serviceOptions={serviceOptions}
      locationOptions={locationOptions}
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
