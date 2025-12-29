'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { Button } from '@/components/atoms/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/atoms/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/atoms/popover'
import { cn } from '@/utilities/ui'

export type ComboboxOption = {
  label: string
  value: string
}

export type ComboboxProps = {
  options: ComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  searchPlaceholder: string
  emptyLabel?: string
  className?: string
  buttonClassName?: string
  contentClassName?: string
}

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder,
  emptyLabel = 'No results found.',
  className,
  buttonClassName,
  contentClassName,
}) => {
  const [open, setOpen] = React.useState(false)

  const selected = options.find((opt) => opt.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          role="combobox"
          aria-expanded={open}
          variant="outline"
          className={cn('w-full justify-between', buttonClassName)}
        >
          <span className={cn(!selected && 'text-muted-foreground')}>{selected?.label ?? placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn('w-[--radix-popover-trigger-width] p-0', contentClassName)} align="start">
        <Command className={className}>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyLabel}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.value}
                  onSelect={(nextValue) => {
                    onValueChange(nextValue === value ? '' : nextValue)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn('mr-2 h-4 w-4', opt.value === value ? 'opacity-100' : 'opacity-0')}
                    aria-hidden="true"
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
