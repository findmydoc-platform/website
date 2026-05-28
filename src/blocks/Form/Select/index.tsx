import type { SelectField } from '@payloadcms/plugin-form-builder/types'
import type { Control, FieldErrors, FieldValues } from 'react-hook-form'

import { Field } from '@/components/atoms/field'
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
    control: Control<FieldValues>
    errors: FieldErrors<FieldValues>
    textColorClass?: string
  }
> = ({ name, control, errors, label, options, required, width, defaultValue, textColorClass = 'text-accent' }) => {
  const errorIdPrefix = React.useId()
  const error = errors?.[name]
  const errorId = `${errorIdPrefix}-${name}-field-error`

  return (
    <Width width={width}>
      <Field data-invalid={error ? true : undefined}>
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
          render={({ field }) => {
            const opts = Array.isArray(options) ? options : []
            const selectedValue = typeof field.value === 'string' ? field.value : undefined

            return (
              <SelectComponent name={field.name} onValueChange={field.onChange} value={selectedValue}>
                <SelectTrigger
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={error ? true : undefined}
                  className={cn('w-full border border-border', textColorClass)}
                  id={name}
                  onBlur={field.onBlur}
                  ref={field.ref}
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
          rules={{ required: required ? 'This field is required.' : false }}
        />
        {error && <Error error={error} id={errorId} />}
      </Field>
    </Width>
  )
}
