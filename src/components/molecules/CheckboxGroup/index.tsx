'use client'

import { Label } from '@/components/atoms/label'
import { CheckboxWithLabel } from '@/components/molecules/CheckboxWithLabel'
import { cn } from '@/utilities/ui'

export type CheckboxOption = string | { label: string; value: string; disabled?: boolean }

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
          const option =
            typeof rawOption === 'string'
              ? { label: rawOption, value: rawOption, disabled: false }
              : { ...rawOption, disabled: Boolean(rawOption.disabled) }
          const isChecked = value.includes(option.value)

          return (
            <CheckboxWithLabel
              key={option.value}
              label={option.label}
              checked={isChecked}
              disabled={option.disabled}
              className={option.disabled ? 'cursor-not-allowed opacity-60' : undefined}
              labelClassName={option.disabled ? 'text-muted-foreground' : undefined}
              onCheckedChange={(checked) => {
                if (option.disabled) return
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
