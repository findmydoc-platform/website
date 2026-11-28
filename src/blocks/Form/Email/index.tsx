import type { EmailField } from '@payloadcms/plugin-form-builder/types'
import type { FieldErrorsImpl, FieldValues, UseFormRegister } from 'react-hook-form'

import { Field } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import React from 'react'

import { defaultFormCopy, type FormCopy } from '@/components/organisms/Form/copy'

import { Error } from '../Error'
import { RequiredCue } from '../RequiredCue'
import { Width } from '../Width'

export const Email: React.FC<
  EmailField & {
    copy?: FormCopy
    errors: Partial<FieldErrorsImpl>
    register: UseFormRegister<FieldValues>
  }
> = ({ name, defaultValue, copy = defaultFormCopy, errors, label, register, required, width }) => {
  const errorIdPrefix = React.useId()
  const error = errors[name]
  const fieldId = `${errorIdPrefix}-${name}`
  const errorId = `${errorIdPrefix}-${name}-field-error`

  return (
    <Width width={width}>
      <Field data-invalid={error ? true : undefined}>
        <Label htmlFor={fieldId}>
          {label}

          {required && <RequiredCue label={copy.requiredCue} />}
        </Label>
        <Input
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          defaultValue={defaultValue}
          id={fieldId}
          required={required || undefined}
          type="email"
          {...register(name, {
            pattern: {
              message: copy.invalidEmail,
              value: /^\S[^\s@]*@\S+$/,
            },
            required: required ? copy.required : false,
          })}
        />

        {error && <Error error={error} id={errorId} />}
      </Field>
    </Width>
  )
}
