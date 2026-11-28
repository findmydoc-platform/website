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

import { defaultFormCopy, type FormCopy } from '@/components/organisms/Form/copy'

import { Error } from '../Error'
import { RequiredCue } from '../RequiredCue'
import { Width } from '../Width'
import { cn } from '@/utilities/ui'

export const Select: React.FC<
  SelectField & {
    control: Control<FieldValues>
    copy?: FormCopy
    errors: FieldErrors<FieldValues>
    textColorClass?: string
  }
> = ({
  name,
  control,
  copy = defaultFormCopy,
  errors,
  label,
  options,
  placeholder,
  required,
  width,
  defaultValue,
  textColorClass = 'text-accent',
}) => {
  const errorIdPrefix = React.useId()
  const error = errors?.[name]
  const fieldId = `${errorIdPrefix}-${name}`
  const errorId = `${errorIdPrefix}-${name}-field-error`

  return (
    <Width width={width}>
      <Field data-invalid={error ? true : undefined}>
        <Label htmlFor={fieldId}>
          {label}
          {required && <RequiredCue label={copy.requiredCue} />}
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
                  aria-required={required || undefined}
                  className={cn('w-full border border-border', textColorClass)}
                  id={fieldId}
                  onBlur={field.onBlur}
                  ref={field.ref}
                >
                  <SelectValue placeholder={placeholder || label} />
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
          rules={{ required: required ? copy.required : false }}
        />
        {error && <Error error={error} id={errorId} />}
      </Field>
    </Width>
  )
}
