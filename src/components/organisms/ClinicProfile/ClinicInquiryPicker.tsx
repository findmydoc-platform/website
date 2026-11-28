'use client'

import * as React from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { Button } from '@/components/atoms/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/atoms/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover'

type Option = { id: string; name: string; keywords?: string[] }
type Props = {
  id: string
  label: string
  options: Option[]
  value: string
  describedBy: string
  invalid: boolean
  onChange: (value: string) => void
}

export const ClinicInquiryPicker = React.forwardRef<HTMLButtonElement, Props>(function ClinicInquiryPicker(
  { id, label, options, value, describedBy, invalid, onChange },
  ref,
) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const search = React.useRef<HTMLInputElement>(null)
  const selected = options.find((option) => option.id === value)
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) setQuery('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          id={id}
          type="button"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          variant="outline"
          className="h-14 w-full justify-between rounded-full border-primary/45 px-4 text-left text-sm whitespace-normal"
        >
          <span className="min-w-0 truncate">{selected?.name || `Select a ${label.toLowerCase()}`}</span>
          <ChevronDown aria-hidden="true" className="size-4 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        className="max-h-[min(360px,var(--radix-popover-content-available-height))] w-[var(--radix-popover-trigger-width)] overflow-hidden p-0"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          search.current?.focus()
        }}
      >
        <Command>
          <div className="relative">
            <CommandInput
              ref={search}
              aria-label={`Search ${label.toLowerCase()} options`}
              placeholder={`Search ${label.toLowerCase()}s`}
              value={query}
              onValueChange={setQuery}
            />
            {query ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 size-9"
                aria-label="Clear search"
                onClick={() => {
                  setQuery('')
                  search.current?.focus()
                }}
              >
                <X aria-hidden="true" />
              </Button>
            ) : null}
          </div>
          <CommandList className="max-h-[min(290px,calc(var(--radix-popover-content-available-height)-70px))]">
            <CommandEmpty>No matching options.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.id}
                  value={option.id}
                  keywords={[option.name, ...(option.keywords || [])]}
                  onSelect={() => {
                    onChange(option.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    aria-hidden="true"
                    className={`mr-2 size-4 ${option.id === value ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {option.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
})
