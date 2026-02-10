'use client'

import { Label } from '@/components/atoms/label'
import { CheckboxWithLabel } from '@/components/molecules/CheckboxWithLabel'
import { cn } from '@/utilities/ui'

export type CheckboxOption = string | { label: string; value: string }

export interface CheckboxGroupProps {
  label: string
  options: CheckboxOption[]
  className?: string
  value: string[]
  onValueChange: (value: string[]) => void
}

export function CheckboxGroup({ label, options, className, value, onValueChange }: CheckboxGroupProps) {
  return (
    <section className={cn('space-y-3', className)}>
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="space-y-2">
        {options.map((rawOption) => {
          const option = typeof rawOption === 'string' ? { label: rawOption, value: rawOption } : rawOption
          const isChecked = value.includes(option.value)

          return (
            <CheckboxWithLabel
              key={option.value}
              label={option.label}
              checked={isChecked}
              onCheckedChange={(checked) => {
                if (checked) {
                  onValueChange([...value, option.value])
                } else {
                  onValueChange(value.filter((v) => v !== option.value))
                }
              }}
            />
          )
        })}
      </div>
    </section>
  )
}
