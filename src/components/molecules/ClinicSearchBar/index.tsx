'use client'

import React from 'react'
import { ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/atoms/command'
import { Input } from '@/components/atoms/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover'
import { cn } from '@/utilities/ui'

type ComboboxOption = {
  label: string
  value: string
}

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
  const [serviceOpen, setServiceOpen] = React.useState(false)
  const [locationOpen, setLocationOpen] = React.useState(false)
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
          <Popover open={serviceOpen} onOpenChange={setServiceOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="clear"
                variant="ghost"
                role="combobox"
                aria-expanded={serviceOpen}
                className={cn(
                  'h-auto w-full justify-between px-0 py-1 text-left text-base font-medium',
                  'text-foreground hover:bg-transparent',
                )}
              >
                <span className={cn(!selectedService && 'text-muted-foreground')}>
                  {selectedService?.label ?? 'Type to search…'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search services…" />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup>
                    {serviceOptions.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={(value) => {
                          setServiceValue(value)
                          setServiceOpen(false)
                        }}
                      >
                        {opt.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Divider />

      <div className="flex flex-1 items-center px-4 md:px-6">
        <div className="w-full">
          <div className="text-sm text-foreground">Location</div>
          <Popover open={locationOpen} onOpenChange={setLocationOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="clear"
                variant="ghost"
                role="combobox"
                aria-expanded={locationOpen}
                className={cn(
                  'h-auto w-full justify-between px-0 py-1 text-left text-base font-medium',
                  'text-foreground hover:bg-transparent',
                )}
              >
                <span className={cn(!selectedLocation && 'text-muted-foreground')}>
                  {selectedLocation?.label ?? 'Type to search…'}
                </span>
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search locations…" />
                <CommandList>
                  <CommandEmpty>No results found.</CommandEmpty>
                  <CommandGroup>
                    {locationOptions.map((opt) => (
                      <CommandItem
                        key={opt.value}
                        value={opt.value}
                        onSelect={(value) => {
                          setLocationValue(value)
                          setLocationOpen(false)
                        }}
                      >
                        {opt.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
