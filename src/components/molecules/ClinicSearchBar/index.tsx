'use client'

import React from 'react'

import { Button } from '@/components/atoms/button'
import { type ComboboxOption, Combobox } from '@/components/atoms/combobox'
import { Input } from '@/components/atoms/input'
import { cn } from '@/utilities/ui'

export type ClinicSearchValues = {
  service: string
  location: string
  budget: string
}

type ClinicSearchControlCopy = {
  label: string
  prompt: string
  search: string
  empty: string
}

export type ClinicSearchBarCopy = {
  service: ClinicSearchControlCopy
  location: ClinicSearchControlCopy
  budget: string
  submit: string
}

const Divider = () => <div className="h-px w-full bg-border lg:h-16 lg:w-px" aria-hidden="true" />

const defaultCopy: ClinicSearchBarCopy = {
  service: {
    label: 'Service',
    prompt: 'Select a service',
    search: 'Search services…',
    empty: 'No services available.',
  },
  location: {
    label: 'Location',
    prompt: 'Select a location',
    search: 'Search locations…',
    empty: 'No locations available.',
  },
  budget: 'Budget (EUR)',
  submit: 'Find my Doctor!',
}

export type ClinicSearchBarProps = {
  className?: string
  copy?: ClinicSearchBarCopy
  values: ClinicSearchValues
  onValuesChange: (values: ClinicSearchValues) => void
  /**
   * Callback fired when the search button is clicked.
   * Responsible for handling navigation or filtering based on the selected values.
   * @param values - The selected service value, location value, and budget.
   */
  onSearch?: (values: ClinicSearchValues) => void
  serviceOptions?: ComboboxOption[]
  locationOptions?: ComboboxOption[]
}

export const ClinicSearchBar: React.FC<ClinicSearchBarProps> = ({
  className,
  copy = defaultCopy,
  values,
  onValuesChange,
  onSearch,
  serviceOptions = [],
  locationOptions = [],
}) => {
  const budgetId = React.useId()

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSearch?.(values)
      }}
      className={cn(
        'flex w-full max-w-5xl flex-col items-stretch rounded-2xl bg-card p-2 shadow-lg',
        'lg:flex-row lg:items-center',
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center px-4 py-2 lg:px-6 lg:py-0">
        <div className="w-full">
          <div className="text-sm text-foreground">{copy.service.label}</div>
          <Combobox
            options={serviceOptions}
            value={values.service}
            onValueChange={(service) => onValuesChange({ ...values, service })}
            ariaLabel={copy.service.label}
            placeholder={copy.service.prompt}
            searchPlaceholder={copy.service.search}
            emptyLabel={copy.service.empty}
            disabled={serviceOptions.length === 0}
            buttonClassName={cn(
              'h-auto min-h-11 w-full justify-between border-0 bg-transparent px-0 py-1 text-left text-base font-medium lg:min-h-0',
              'shadow-none hover:bg-transparent [&>span]:min-w-0 [&>span]:truncate',
            )}
          />
        </div>
      </div>

      <Divider />

      <div className="flex min-w-0 flex-1 items-center px-4 py-2 lg:px-6 lg:py-0">
        <div className="w-full">
          <div className="text-sm text-foreground">{copy.location.label}</div>
          <Combobox
            options={locationOptions}
            value={values.location}
            onValueChange={(location) => onValuesChange({ ...values, location })}
            ariaLabel={copy.location.label}
            placeholder={copy.location.prompt}
            searchPlaceholder={copy.location.search}
            emptyLabel={copy.location.empty}
            disabled={locationOptions.length === 0}
            buttonClassName={cn(
              'h-auto min-h-11 w-full justify-between border-0 bg-transparent px-0 py-1 text-left text-base font-medium lg:min-h-0',
              'shadow-none hover:bg-transparent [&>span]:min-w-0 [&>span]:truncate',
            )}
          />
        </div>
      </div>

      <Divider />

      <div className="flex min-w-0 flex-1 items-center px-4 py-2 lg:px-6 lg:py-0">
        <div className="w-full">
          <label className="text-sm text-foreground" htmlFor={budgetId}>
            {copy.budget}
          </label>
          <Input
            id={budgetId}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={values.budget}
            onChange={(e) => onValuesChange({ ...values, budget: e.target.value })}
            className="h-auto min-h-11 border-0 bg-transparent px-0 py-1 text-base font-medium text-foreground lg:min-h-0 lg:text-base"
            placeholder="12000"
          />
        </div>
      </div>

      <div className="flex items-center px-2 pt-2 lg:pt-0 lg:pr-2 lg:pl-4">
        <Button
          type="submit"
          variant="primary"
          hoverEffect="wave"
          className="h-10 min-h-11 w-full rounded-full px-6 lg:min-h-0 lg:w-auto"
        >
          {copy.submit}
        </Button>
      </div>
    </form>
  )
}
