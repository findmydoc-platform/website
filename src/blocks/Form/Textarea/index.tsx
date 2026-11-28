import type { TextField } from '@payloadcms/plugin-form-builder/types'
import type { FieldErrorsImpl, FieldValues, UseFormRegister } from 'react-hook-form'

import { Field } from '@/components/atoms/field'
import { Label } from '@/components/atoms/label'
import { Textarea as TextAreaComponent } from '@/components/atoms/textarea'
import React from 'react'

import { defaultFormCopy, type FormCopy } from '@/components/organisms/Form/copy'

import { Error } from '../Error'
import { RequiredCue } from '../RequiredCue'
import { Width } from '../Width'

export const Textarea: React.FC<
  TextField & {
    copy?: FormCopy
    errors: Partial<FieldErrorsImpl>
    register: UseFormRegister<FieldValues>
    rows?: number
  }
> = ({ name, defaultValue, copy = defaultFormCopy, errors, label, register, required, rows = 3, width }) => {
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

        <TextAreaComponent
          aria-describedby={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          defaultValue={defaultValue}
          id={fieldId}
          required={required || undefined}
          rows={rows}
          {...register(name, { required: required ? copy.required : false })}
        />

        {error && <Error error={error} id={errorId} />}
      </Field>
    </Width>
  )
}
