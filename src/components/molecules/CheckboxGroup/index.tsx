'use client'

import { Label } from '@/components/atoms/label'
import { CheckboxWithLabel } from '@/components/molecules/CheckboxWithLabel'
import { cn } from '@/utilities/ui'

export interface CheckboxGroupProps {
  label: string
  options: string[]
  className?: string
  value: string[]
  onValueChange: (value: string[]) => void
}

export function CheckboxGroup({ label, options, className, value, onValueChange }: CheckboxGroupProps) {
  return (
    <section className={cn('space-y-3', className)}>
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
                if (checked) {
                  onValueChange([...value, option])
                } else {
                  onValueChange(value.filter((v) => v !== option))
                }
              }}
            />
          )
        })}
      </div>
    </section>
  )
}
