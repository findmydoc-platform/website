'use client'

import React from 'react'

import { Button } from '@/components/atoms/button'
import { type ComboboxOption, Combobox } from '@/components/atoms/combobox'
import { Input } from '@/components/atoms/input'
import { cn } from '@/utilities/ui'

export type ClinicSearchBarProps = {
  className?: string
  onSearch?: (values: { service: string; location: string; budget: string }) => void
  serviceOptions?: ComboboxOption[]
  locationOptions?: ComboboxOption[]
  defaultServiceValue?: string
  defaultLocationValue?: string
  defaultBudget?: string
}

export const ClinicSearchBar: React.FC<ClinicSearchBarProps> = ({
  className,
  onSearch,
  serviceOptions = [
    { label: 'Nose Job', value: 'nose-job' },
    { label: 'Hair Transplant', value: 'hair-transplant' },
    { label: 'Teeth Whitening', value: 'teeth-whitening' },
    { label: 'LASIK', value: 'lasik' },
  ],
  locationOptions = [
    { label: 'Istanbul', value: 'istanbul' },
    { label: 'Antalya', value: 'antalya' },
    { label: 'Izmir', value: 'izmir' },
    { label: 'Ankara', value: 'ankara' },
  ],
  defaultServiceValue,
  defaultLocationValue,
  defaultBudget,
}) => {
  const [serviceValue, setServiceValue] = React.useState<string>(defaultServiceValue ?? '')
  const [locationValue, setLocationValue] = React.useState<string>(defaultLocationValue ?? '')
  const [budget, setBudget] = React.useState<string>(defaultBudget ?? '')

  const selectedService = serviceOptions.find((o) => o.value === serviceValue)
  const selectedLocation = locationOptions.find((o) => o.value === locationValue)

  const handleSearch = () => {
    onSearch?.({
      service: selectedService?.label ?? '',
      location: selectedLocation?.label ?? '',
      budget,
    })
  }

  const Divider = () => <div className="h-16 w-px bg-border" aria-hidden="true" />

  return (
    <div
      className={cn(
        'flex w-full max-w-5xl items-stretch rounded-2xl bg-card p-2 shadow-lg',
        'md:items-center',
        className,
      )}
    >
      <div className="flex flex-1 items-center px-4 md:px-6">
        <div className="w-full">
          <div className="text-sm text-foreground">Service</div>
          <Combobox
            options={serviceOptions}
            value={serviceValue}
            onValueChange={setServiceValue}
            placeholder="Select a service"
            searchPlaceholder="Search services…"
            buttonClassName={cn(
              'h-auto w-full justify-between border-0 bg-transparent px-0 py-1 text-left text-base font-medium',
              'shadow-none hover:bg-transparent',
            )}
            contentClassName=""
          />
        </div>
      </div>

      <Divider />

      <div className="flex flex-1 items-center px-4 md:px-6">
        <div className="w-full">
          <div className="text-sm text-foreground">Location</div>
          <Combobox
            options={locationOptions}
            value={locationValue}
            onValueChange={setLocationValue}
            placeholder="Select a location"
            searchPlaceholder="Search locations…"
            buttonClassName={cn(
              'h-auto w-full justify-between border-0 bg-transparent px-0 py-1 text-left text-base font-medium',
              'shadow-none hover:bg-transparent',
            )}
            contentClassName=""
          />
        </div>
      </div>

      <Divider />

      <div className="flex flex-1 items-center px-4 md:px-6">
        <div className="w-full">
          <label className="text-sm text-foreground" htmlFor="clinic-search-budget">
            Budget
          </label>
          <Input
            id="clinic-search-budget"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            className={cn(
              'h-auto border-0 bg-transparent px-0 py-1 text-base font-medium text-foreground',
              'placeholder:text-muted-foreground focus-visible:ring-0',
            )}
            placeholder="12000"
            aria-label="Budget"
          />
        </div>
      </div>

      <div className="flex items-center pl-2 pr-2 md:pl-4">
        <Button
          type="button"
          variant="primary"
          className="h-10 rounded-full px-6"
          onClick={handleSearch}
          aria-label="Search"
        >
          Find my Doctor!
        </Button>
      </div>
    </div>
  )
}
