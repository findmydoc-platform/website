'use client'

import { useState } from 'react'
import { Label } from '@/components/atoms/label'
import { CheckboxWithLabel } from '@/components/molecules/CheckboxWithLabel'
import { cn } from '@/utilities/ui'

export interface CheckboxGroupProps {
  label: string
  options: string[]
  className?: string
  value?: string[]
  defaultValue?: string[]
  onValueChange?: (value: string[]) => void
}

export function CheckboxGroup({
  label,
  options,
  className,
  value: valueProp,
  defaultValue = [],
  onValueChange,
}: CheckboxGroupProps) {
  const [internalValue, setInternalValue] = useState<string[]>(defaultValue)
  const isControlled = valueProp !== undefined
  const value = valueProp ?? internalValue
  const setValue = isControlled ? onValueChange : setInternalValue

  return (
    <section className={cn('space-y-5', className)}>
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="space-y-2">
        {options.map((option) => {
          const isChecked = value.includes(option)

          return (
            <CheckboxWithLabel
              key={option}
              label={option}
              checked={isChecked}
              onCheckedChange={(checked) => {
                if (!setValue) return

                if (checked) {
                  setValue([...value, option])
                } else {
                  setValue(value.filter((v) => v !== option))
                }
              }}
            />
          )
        })}
      </div>
    </section>
  )
}
