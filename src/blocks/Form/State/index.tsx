import type { StateField } from '@payloadcms/plugin-form-builder/types'
import type { Control, FieldErrorsImpl } from 'react-hook-form'

import { Field } from '@/components/atoms/field'
import { Label } from '@/components/atoms/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select'
import React from 'react'
import { Controller } from 'react-hook-form'

import { Error } from '../Error'
import { Width } from '../Width'
import { stateOptions } from './options'

export const State: React.FC<
  StateField & {
    control: Control
    errors: Partial<FieldErrorsImpl>
  }
> = ({ name, control, errors, label, required, width }) => {
  const errorIdPrefix = React.useId()
  const error = errors[name]
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
          defaultValue=""
          name={name}
          render={({ field }) => {
            const controlledValue = stateOptions.find((t) => t.value === field.value)

            return (
              <Select name={field.name} onValueChange={(val) => field.onChange(val)} value={controlledValue?.value}>
                <SelectTrigger
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={error ? true : undefined}
                  className="w-full"
                  id={name}
                  onBlur={field.onBlur}
                  ref={field.ref}
                >
                  <SelectValue placeholder={label} />
                </SelectTrigger>
                <SelectContent>
                  {stateOptions.map(({ label, value }) => {
                    return (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )
          }}
          rules={{ required: required ? 'This field is required.' : false }}
        />
        {error && <Error error={error} id={errorId} />}
      </Field>
    </Width>
  )
}
