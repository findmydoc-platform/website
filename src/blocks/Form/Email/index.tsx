import type { EmailField } from '@payloadcms/plugin-form-builder/types'
import type { FieldErrorsImpl, FieldValues, UseFormRegister } from 'react-hook-form'

import { Field } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import React from 'react'

import { Error } from '../Error'
import { Width } from '../Width'

export const Email: React.FC<
  EmailField & {
    errors: Partial<FieldErrorsImpl>
    register: UseFormRegister<FieldValues>
  }
> = ({ name, defaultValue, errors, label, register, required, width }) => {
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
        <Input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          defaultValue={defaultValue}
          id={name}
          required={required || undefined}
          type="email"
          {...register(name, {
            pattern: {
              message: 'Enter a valid email address.',
              value: /^\S[^\s@]*@\S+$/,
            },
            required: required ? 'This field is required.' : false,
          })}
        />

        {error && <Error error={error} id={errorId} />}
      </Field>
    </Width>
  )
}
