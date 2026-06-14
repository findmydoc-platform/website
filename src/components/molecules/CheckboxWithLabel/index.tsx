'use client'

import * as React from 'react'
import { type ComponentProps, useId } from 'react'
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
  const checkboxId = useId()

  const handleCheckedChange: ComponentProps<typeof Checkbox>['onCheckedChange'] = (next) => {
    if (typeof next !== 'boolean') return
    onCheckedChange?.(next)
  }

  const handleKeyDown: React.KeyboardEventHandler<HTMLLabelElement> = (event) => {
    if (disabled) return

    if (event.key !== ' ' && event.key !== 'Enter') {
      return
    }

    event.preventDefault()
    onCheckedChange?.(!checked)
  }

  const toggleSelection = () => {
    if (disabled) return
    onCheckedChange?.(!checked)
  }

  return (
    <label
      htmlFor={checkboxId}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      className={cn(
        'flex min-h-11 cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/40',
        disabled && 'cursor-not-allowed opacity-60 hover:bg-transparent',
        className,
      )}
      onClick={toggleSelection}
      onKeyDown={handleKeyDown}
    >
      <Checkbox
        id={checkboxId}
        aria-labelledby={`${checkboxId}-label`}
        checked={checked}
        disabled={disabled}
        className={cn('mt-0.5 h-5 w-5', checkboxClassName)}
        onCheckedChange={handleCheckedChange}
        onClick={(event) => event.stopPropagation()}
      />
      <span
        id={`${checkboxId}-label`}
        className={cn('min-w-0 flex-1 pt-0.5 text-sm leading-5 font-normal break-words', labelClassName)}
      >
        {label}
      </span>
    </label>
  )
}
