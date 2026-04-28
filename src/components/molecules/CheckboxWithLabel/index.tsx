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
    <label className={cn('flex items-start gap-3', disabled && 'cursor-not-allowed', className)}>
      <Checkbox
        checked={checked}
        disabled={disabled}
        className={checkboxClassName}
        onCheckedChange={handleCheckedChange}
      />
      <span className={cn('min-w-0 flex-1 pt-0.5 text-sm leading-5 font-normal break-words', labelClassName)}>
        {label}
      </span>
    </label>
  )
}
