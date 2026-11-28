import type { CheckboxField } from '@payloadcms/plugin-form-builder/types'
import type { FieldErrorsImpl, FieldValues, UseFormRegister } from 'react-hook-form'

import { useFormContext } from 'react-hook-form'

import { Checkbox as CheckboxUi } from '@/components/atoms/checkbox'
import { Field } from '@/components/atoms/field'
import { Label } from '@/components/atoms/label'
import React from 'react'

import { defaultFormCopy, type FormCopy } from '@/components/organisms/Form/copy'

import { Error } from '../Error'
import { RequiredCue } from '../RequiredCue'
import { Width } from '../Width'

export const Checkbox: React.FC<
  CheckboxField & {
    copy?: FormCopy
    errors: Partial<FieldErrorsImpl>
    register: UseFormRegister<FieldValues>
  }
> = ({ name, defaultValue, copy = defaultFormCopy, errors, label, register, required, width }) => {
  const errorIdPrefix = React.useId()
  const error = errors[name]
  const fieldId = `${errorIdPrefix}-${name}`
  const errorId = `${errorIdPrefix}-${name}-field-error`
  const props = register(name, { required: required ? copy.required : false })
  const { setValue } = useFormContext()

  return (
    <Width width={width}>
      <Field data-invalid={error ? true : undefined}>
        <div className="flex items-center gap-2">
          <CheckboxUi
            aria-describedby={error ? errorId : undefined}
            aria-invalid={error ? true : undefined}
            aria-required={required || undefined}
            defaultChecked={defaultValue}
            id={fieldId}
            {...props}
            onCheckedChange={(checked) => {
              setValue(props.name, checked, { shouldValidate: true })
            }}
          />
          <Label htmlFor={fieldId}>
            {required && <RequiredCue label={copy.requiredCue} />}
            {label}
          </Label>
        </div>
        {error && <Error error={error} id={errorId} />}
      </Field>
    </Width>
  )
}
