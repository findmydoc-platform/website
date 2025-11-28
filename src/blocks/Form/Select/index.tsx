import type { SelectField } from '@payloadcms/plugin-form-builder/types'
import type { Control, FieldErrors } from 'react-hook-form'

import { Label } from '@/components/atoms/label'
import {
  Select as SelectComponent,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/atoms/select'
import React from 'react'
import { Controller } from 'react-hook-form'

import { Error } from '../Error'
import { Width } from '../Width'
import { cn } from '@/utilities/ui'

export const Select: React.FC<
  SelectField & {
    control: Control<any>
    errors: FieldErrors<any>
    textColorClass?: string
  }
> = ({ name, control, errors, label, options, required, width, defaultValue, textColorClass = 'text-accent' }) => {
  return (
    <Width width={width}>
      <Label htmlFor={name}>
        {label}
        {required && (
          <span className="required">
            * <span className="sr-only">(required)</span>
          </span>
        )}
      </Label>
      <Controller
        control={control}
        defaultValue={defaultValue}
        name={name}
        render={({ field: { onChange, value } }) => {
          const opts = Array.isArray(options) ? options : []
          const selectedValue = typeof value === 'string' ? value : undefined
          const hasError = Boolean((errors as Record<string, unknown>)?.[name])

          return (
            <SelectComponent onValueChange={onChange} value={selectedValue}>
              <SelectTrigger
                className={cn('w-full border border-border', textColorClass)}
                id={name}
                aria-invalid={hasError || undefined}
                aria-describedby={hasError ? `${name}-error` : undefined}
              >
                <SelectValue placeholder={label} />
              </SelectTrigger>
              <SelectContent>
                {opts.map(({ label, value }) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </SelectComponent>
          )
        }}
        rules={{ required: required ? 'This field is required' : false }}
      />
      {!!(errors as Record<string, unknown>)?.[name] && (
        <div id={`${name}-error`}>
          <Error />
        </div>
      )}
    </Width>
  )
}
