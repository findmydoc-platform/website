'use client'

import * as React from 'react'
import { Label } from '@/components/atoms/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select'
import { cn } from '@/utilities/ui'

export type SortControlProps = {
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  label?: string
  className?: string
}

export function SortControl({
  value,
  onValueChange,
  options,
  label = 'Sort by',
  className,
}: SortControlProps) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <Label htmlFor="sort-control" className="text-sm font-medium text-foreground">
        {label}
      </Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id="sort-control" className="w-48">
          <SelectValue placeholder="Select sort option" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
