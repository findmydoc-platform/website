'use client'

import React from 'react'

import { Button } from '@/components/atoms/button'
import { type ComboboxOption, Combobox } from '@/components/atoms/combobox'
import { Input } from '@/components/atoms/input'
import { cn } from '@/utilities/ui'

export type ClinicSearchBarProps = {
  className?: string
  /**
   * Callback fired when the search button is clicked.
   * Responsible for handling navigation or filtering based on the selected values.
   * @param values - The selected service value, location value, and budget.
   */
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
  serviceOptions = [],
  locationOptions = [],
  defaultServiceValue,
  defaultLocationValue,
  defaultBudget,
}) => {
  const [serviceValue, setServiceValue] = React.useState<string>(defaultServiceValue ?? '')
  const [locationValue, setLocationValue] = React.useState<string>(defaultLocationValue ?? '')
  const [budget, setBudget] = React.useState<string>(defaultBudget ?? '')

  const handleSearch = () => {
    onSearch?.({
      service: serviceValue,
      location: locationValue,
      budget,
    })
  }

  const Divider = () => <div className="bg-border h-16 w-px" aria-hidden="true" />

  return (
    <div
      className={cn(
        'bg-card flex w-full max-w-5xl items-stretch rounded-2xl p-2 shadow-lg',
        'md:items-center',
        className,
      )}
    >
      <div className="flex flex-1 items-center px-4 md:px-6">
        <div className="w-full">
          <div className="text-foreground text-sm">Service</div>
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
          />
        </div>
      </div>

      <Divider />

      <div className="flex flex-1 items-center px-4 md:px-6">
        <div className="w-full">
          <div className="text-foreground text-sm">Location</div>
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
          />
        </div>
      </div>

      <Divider />

      <div className="flex flex-1 items-center px-4 md:px-6">
        <div className="w-full">
          <label className="text-foreground text-sm" htmlFor="clinic-search-budget">
            Budget (USD)
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
              'text-foreground h-auto border-0 bg-transparent px-0 py-1 text-base font-medium',
              'placeholder:text-muted-foreground focus-visible:ring-0',
            )}
            placeholder="12000"
            aria-label="Budget in USD"
          />
        </div>
      </div>

      <div className="flex items-center pl-2 pr-2 md:pl-4">
        <Button
          type="button"
          variant="primary"
          hoverEffect="wave"
          className="h-10 rounded-full px-6"
          onClick={handleSearch}
        >
          Find my Doctor!
        </Button>
      </div>
    </div>
  )
}
