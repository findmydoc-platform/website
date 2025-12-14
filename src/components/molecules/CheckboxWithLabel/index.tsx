'use client'

import type { ComponentProps } from 'react'
import { Checkbox } from '@/components/atoms/checkbox'
import { cn } from '@/utilities/ui'

export interface CheckboxWithLabelProps {
  label: string
  checked?: boolean
  disabled?: boolean
  className?: string
  checkboxClassName?: string
  labelClassName?: string
  onCheckedChange?: (checked: boolean) => void
}

export function CheckboxWithLabel({
  label,
  checked,
  disabled,
  className,
  checkboxClassName,
  labelClassName,
  onCheckedChange,
}: CheckboxWithLabelProps) {
  const handleCheckedChange: ComponentProps<typeof Checkbox>['onCheckedChange'] = (next) => {
    if (typeof next !== 'boolean') return
    onCheckedChange?.(next)
  }

  return (
    <label className={cn('flex items-center gap-3', className)}>
      <Checkbox
        checked={checked}
        disabled={disabled}
        className={cn(checkboxClassName)}
        onCheckedChange={handleCheckedChange}
      />
      <span className={cn('text-sm font-normal', labelClassName)}>{label}</span>
    </label>
  )
}
