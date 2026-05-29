import type * as React from 'react'

import { Field, FieldError } from '@/components/atoms/field'
import { Input } from '@/components/atoms/input'
import { Label } from '@/components/atoms/label'
import type { ClinicRegistrationFormValues, IconComponent, PublicFormValidationController } from '../types'

export function RegistrationField({
  descriptionId,
  icon: Icon,
  id,
  label,
  name,
  onValueChange,
  placeholder,
  required,
  type = 'text',
  validation,
  value,
}: {
  descriptionId?: string
  icon?: IconComponent
  id: string
  label: string
  name: keyof ClinicRegistrationFormValues
  onValueChange: (value: string) => void
  placeholder: string
  required?: boolean
  type?: React.HTMLInputTypeAttribute
  validation: PublicFormValidationController
  value: string
}) {
  const error = validation.getFieldError(name)
  const errorId = validation.getFieldErrorId(name)

  return (
    <Field className="min-w-0 gap-2 text-left" data-invalid={error ? true : undefined}>
      <Label className="mb-2 block text-left text-sm font-semibold text-[#172033]" htmlFor={id}>
        {label}
      </Label>
      <div className="relative">
        <Input
          {...validation.getFieldProps(name, descriptionId)}
          className="h-[60px] min-w-0 rounded-[8px] border-slate-300 bg-[#fbfcff] px-3 pr-10 text-base text-slate-500 sm:px-4 sm:pr-12 md:text-base"
          id={id}
          name={name}
          onChange={(event) => {
            validation.handleFieldChange(event)
            onValueChange(event.currentTarget.value)
          }}
          placeholder={placeholder}
          required={required}
          type={type}
          value={value}
        />
        {Icon ? (
          <Icon
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400 sm:right-4 sm:size-5"
          />
        ) : null}
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </Field>
  )
}
