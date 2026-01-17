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
      onSearch={() => {
        router.push('/listing-comparison')
      }}
    />
  )
}
