'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import type { ComboboxOption } from '@/components/atoms/combobox'
import {
  ClinicSearchBar,
  type ClinicSearchBarCopy,
  type ClinicSearchValues,
} from '@/components/molecules/ClinicSearchBar'

type LandingHeroSearchBarClientProps = {
  className?: string
  copy?: ClinicSearchBarCopy
  destination?: string
  serviceOptions?: ComboboxOption[]
  locationOptions?: ComboboxOption[]
}

export function LandingHeroSearchBarClient({
  className,
  copy,
  destination = '/listing-comparison',
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
      copy={copy}
      values={values}
      onValuesChange={setValues}
      serviceOptions={serviceOptions}
      locationOptions={locationOptions}
      onSearch={(nextValues) => {
        const params = new URLSearchParams()
        if (nextValues.service.trim().length > 0) {
          params.set('specialty', nextValues.service.trim())
        }
        if (nextValues.location.trim().length > 0) {
          params.set('location', nextValues.location.trim())
        }
        if (nextValues.budget.trim().length > 0) {
          params.set('budget', nextValues.budget.trim())
        }

        const query = params.toString()
        router.push(query ? `${destination}?${query}` : destination)
      }}
    />
  )
}
