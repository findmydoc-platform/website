'use client'

import * as React from 'react'
import { Label } from '@/components/atoms/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select'
import { cn } from '@/utilities/ui'

export type SortControlOption<T extends string> = {
  value: T
  label: string
}

export type SortControlProps<T extends string> = {
  value: T
  onValueChange: (value: T) => void
  options: Array<SortControlOption<T>>
  label?: string
  className?: string
  id?: string
}

const SORT_CONTROL_PLACEHOLDER = 'Select sort option'

type SortSelectProps<T extends string> = {
  value: T
  onValueChange: (value: string) => void
  options: Array<SortControlOption<T>>
  id: string
  triggerClassName?: string
  contentClassName?: string
  valueClassName?: string
  placeholder?: string
}

const SortSelect = <T extends string>({
  value,
  onValueChange,
  options,
  id,
  triggerClassName,
  contentClassName,
  valueClassName,
  placeholder = SORT_CONTROL_PLACEHOLDER,
}: SortSelectProps<T>) => (
  <Select value={value} onValueChange={onValueChange}>
    <SelectTrigger id={id} className={cn('w-48', triggerClassName)}>
      <SelectValue className={valueClassName} placeholder={placeholder} />
    </SelectTrigger>
    <SelectContent className={contentClassName}>
      {options.map((option) => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
)

export function SortControl<T extends string>({
  value,
  onValueChange,
  options,
  label = 'Sort',
  className,
  id,
}: SortControlProps<T>) {
  const generatedId = React.useId()
  const controlId = id ?? generatedId
  const optionValues = React.useMemo(() => new Set<T>(options.map((option) => option.value)), [options])
  const handleValueChange = React.useCallback(
    (nextValue: string) => {
      if (optionValues.has(nextValue as T)) {
        onValueChange(nextValue as T)
      }
    },
    [onValueChange, optionValues],
  )
  return (
    <React.Fragment>
      <Label htmlFor={controlId} className="sr-only">
        {label}
      </Label>
      <SortSelect
        value={value}
        onValueChange={handleValueChange}
        options={options}
        id={controlId}
        triggerClassName={cn(
          'h-8 w-36 rounded-md border border-border/60 bg-muted/50 px-2 text-sm shadow-xs',
          className,
        )}
        contentClassName="rounded-xl"
      />
    </React.Fragment>
  )
}
