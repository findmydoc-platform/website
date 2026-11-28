import type { CountryField } from '@payloadcms/plugin-form-builder/types'
import type { Control, FieldErrorsImpl } from 'react-hook-form'

import { Field } from '@/components/atoms/field'
import { Label } from '@/components/atoms/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/atoms/select'
import React from 'react'
import { Controller } from 'react-hook-form'

import { defaultFormCopy, type FormCopy } from '@/components/organisms/Form/copy'

import { Error } from '../Error'
import { RequiredCue } from '../RequiredCue'
import { Width } from '../Width'
import { countryOptions } from './options'

export const Country: React.FC<
  CountryField & {
    control: Control
    locale?: 'de' | 'en'
    copy?: FormCopy
    errors: Partial<FieldErrorsImpl>
  }
> = ({ name, control, copy = defaultFormCopy, errors, label, locale = 'en', required, width }) => {
  const displayNames = React.useMemo(() => new Intl.DisplayNames(locale, { type: 'region' }), [locale])
  const errorIdPrefix = React.useId()
  const error = errors[name]
  const fieldId = `${errorIdPrefix}-${name}`
  const errorId = `${errorIdPrefix}-${name}-field-error`

  return (
    <Width width={width}>
      <Field data-invalid={error ? true : undefined}>
        <Label className="" htmlFor={fieldId}>
          {label}

          {required && <RequiredCue label={copy.requiredCue} />}
        </Label>
        <Controller
          control={control}
          defaultValue=""
          name={name}
          render={({ field }) => {
            const controlledValue = countryOptions.find((t) => t.value === field.value)

            return (
              <Select name={field.name} onValueChange={(val) => field.onChange(val)} value={controlledValue?.value}>
                <SelectTrigger
                  aria-describedby={error ? errorId : undefined}
                  aria-invalid={error ? true : undefined}
                  aria-required={required || undefined}
                  className="w-full"
                  id={fieldId}
                  onBlur={field.onBlur}
                  ref={field.ref}
                >
                  <SelectValue placeholder={label} />
                </SelectTrigger>
                <SelectContent>
                  {countryOptions.map(({ label, value }) => {
                    return (
                      <SelectItem key={value} value={value}>
                        {locale === 'en' ? label : (displayNames.of(value) ?? label)}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )
          }}
          rules={{ required: required ? copy.required : false }}
        />
        {error && <Error error={error} id={errorId} />}
      </Field>
    </Width>
  )
}
