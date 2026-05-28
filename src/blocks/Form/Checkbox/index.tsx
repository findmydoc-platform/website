import type { CheckboxField } from '@payloadcms/plugin-form-builder/types'
import type { FieldErrorsImpl, FieldValues, UseFormRegister } from 'react-hook-form'

import { useFormContext } from 'react-hook-form'

import { Checkbox as CheckboxUi } from '@/components/atoms/checkbox'
import { Field } from '@/components/atoms/field'
import { Label } from '@/components/atoms/label'
import React from 'react'

import { Error } from '../Error'
import { Width } from '../Width'

export const Checkbox: React.FC<
  CheckboxField & {
    errors: Partial<FieldErrorsImpl>
    register: UseFormRegister<FieldValues>
  }
> = ({ name, defaultValue, errors, label, register, required, width }) => {
  const errorIdPrefix = React.useId()
  const error = errors[name]
  const errorId = `${errorIdPrefix}-${name}-field-error`
  const props = register(name, { required: required ? 'This field is required.' : false })
  const { setValue } = useFormContext()

  return (
    <Width width={width}>
      <Field data-invalid={error ? true : undefined}>
        <div className="flex items-center gap-2">
          <CheckboxUi
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            defaultChecked={defaultValue}
            id={name}
            {...props}
            onCheckedChange={(checked) => {
              setValue(props.name, checked, { shouldValidate: true })
            }}
          />
          <Label htmlFor={name}>
            {required && (
              <span className="required">
                * <span className="sr-only">(required)</span>
              </span>
            )}
            {label}
          </Label>
        </div>
        {error && <Error error={error} id={errorId} />}
      </Field>
    </Width>
  )
}
