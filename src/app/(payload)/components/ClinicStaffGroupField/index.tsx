'use client'

import { RelationshipField, useFormFields, useFormSubmitted } from '@payloadcms/ui'
import type { RelationshipFieldClientProps } from 'payload'

import './index.scss'

export function ClinicStaffGroupField(props: RelationshipFieldClientProps) {
  const submitted = useFormSubmitted()
  const fieldState = useFormFields(([fields]) => fields[props.path])
  const errorMessage = fieldState?.errorMessage
  const errorId = `${props.path.replaceAll('.', '__')}-assignment-error`
  const hasError = Boolean(submitted && fieldState?.valid === false && errorMessage)

  return (
    <fieldset
      aria-label="Group"
      aria-invalid={hasError || undefined}
      aria-describedby={hasError ? errorId : undefined}
      className="clinic-staff-group-field"
    >
      <RelationshipField {...props} />
      {hasError && (
        <p className="clinic-staff-group-field__error" id={errorId} role="alert">
          {errorMessage}
        </p>
      )}
    </fieldset>
  )
}

export function ClinicStaffGroupTooltipError() {
  return null
}
